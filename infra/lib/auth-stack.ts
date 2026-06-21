import * as fs from "fs";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

// OAuth settings for the web client. These are the single source of truth:
// AuthStack uses them to create the client, and FrontendStack reuses them when
// it registers the deployed CloudFront URL as an allowed callback (see the
// custom resource in frontend-stack.ts). updateUserPoolClient is a full
// replace, so any field we want to preserve must be repeated there.
export const OAUTH_SCOPES = ["openid", "email"];
export const OAUTH_FLOWS = ["code"];
export const EXPLICIT_AUTH_FLOWS = [
  "ALLOW_USER_SRP_AUTH",
  "ALLOW_REFRESH_TOKEN_AUTH",
];
// Local development URLs. The deployed CloudFront URL is appended at deploy
// time by FrontendStack.
export const DEV_CALLBACK_URLS = ["http://localhost:5173/callback"];
export const DEV_LOGOUT_URLS = ["http://localhost:5173"];

// CSS for the Cognito Hosted UI (the page login() redirects to). Cognito only
// accepts a fixed set of "-customizable" selectors and a limited set of
// properties on each; anything outside that allow-list is rejected at deploy
// time. The values below mirror the app's design tokens (frontend
// tailwind.config.js / LoginPage.tsx) so the sign-in window matches the rest of
// the application: brand blue buttons, the light "canvas" background, the dark
// "ink" text colour, the panelled input borders and the Public Sans font.
const HOSTED_UI_CSS = `
.background-customizable {
  background-color: #eef0f3;
  font-family: 'Public Sans', system-ui, -apple-system, sans-serif;
}
.banner-customizable {
  padding: 25px 0px 25px 0px;
  background-color: #eef0f3;
}
.logo-customizable {
  max-width: 80%;
  max-height: 30%;
}
.label-customizable {
  font-weight: 600;
  color: #16202b;
}
.textDescription-customizable {
  padding-top: 10px;
  padding-bottom: 10px;
  display: block;
  font-size: 16px;
  color: #3a444f;
}
.idpDescription-customizable {
  padding-top: 10px;
  padding-bottom: 10px;
  display: block;
  font-size: 16px;
  color: #3a444f;
}
.legalText-customizable {
  color: #8a93a0;
  font-size: 11px;
}
.inputField-customizable {
  width: 100%;
  height: 40px;
  color: #16202b;
  background-color: #ffffff;
  border: 1px solid #dfe3e9;
  border-radius: 11px;
}
.inputField-customizable:focus {
  border-color: #0b5cab;
  outline: 0;
}
.submitButton-customizable {
  font-size: 14px;
  font-weight: 600;
  margin: 20px 0px 10px 0px;
  height: 44px;
  width: 100%;
  color: #ffffff;
  background-color: #0b5cab;
  border-radius: 11px;
}
.submitButton-customizable:hover {
  color: #ffffff;
  background-color: #083f78;
}
.idpButton-customizable {
  height: 44px;
  width: 100%;
  text-align: center;
  margin-bottom: 15px;
  color: #ffffff;
  background-color: #0b5cab;
  border-radius: 11px;
}
.idpButton-customizable:hover {
  color: #ffffff;
  background-color: #083f78;
}
.errorMessage-customizable {
  padding: 5px;
  font-size: 14px;
  width: 100%;
  background: #ffffff;
  border: 1px solid #d64958;
  color: #d64958;
  border-radius: 11px;
}
.redirect-customizable {
  text-align: center;
}
.passwordCheck-notValid-customizable {
  color: #d64958;
}
.passwordCheck-valid-customizable {
  color: #0b5cab;
}
`;

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly cognitoDomain: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, "ChatUserPool", {
      userPoolName: "chat-service-users",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const domainPrefix = `chat-service-${this.account}`;
    const userPoolDomain = this.userPool.addDomain("CognitoDomain", {
      cognitoDomain: { domainPrefix },
    });
    this.cognitoDomain = `https://${domainPrefix}.auth.${this.region}.amazoncognito.com`;

    // Style the Cognito Hosted UI to match the rest of the app: the brand CSS
    // (see HOSTED_UI_CSS above) plus the app's logo (the same favicon the
    // frontend serves). The L1 CfnUserPoolUICustomizationAttachment only
    // supports CSS — to also set a logo we must call SetUICustomization, which
    // takes the image bytes via ImageFile. SetUICustomization replaces the
    // *entire* customization for the client in one call, so the CSS and image
    // are set together here rather than split across two resources that would
    // clobber each other. ClientId "ALL" applies to every app client.
    //
    // ImageFile is a binary blob; AwsCustomResource (AWS SDK v3) base64-decodes
    // string values for blob-typed parameters, so the PNG is read at synth time
    // and passed as a base64 string. The favicon is tiny (well under Cognito's
    // 100 KB logo limit).
    const logoBase64 = fs
      .readFileSync(
        path.join(__dirname, "..", "..", "frontend", "public", "favicon.png")
      )
      .toString("base64");

    const uiCustomization = new cr.AwsCustomResource(
      this,
      "HostedUiCustomization",
      {
        onUpdate: {
          service: "CognitoIdentityServiceProvider",
          action: "setUICustomization",
          parameters: {
            UserPoolId: this.userPool.userPoolId,
            ClientId: "ALL",
            CSS: HOSTED_UI_CSS,
            ImageFile: logoBase64,
          },
          // Stable id; AwsCustomResource re-runs whenever the call parameters
          // (CSS or image) change, so a new logo/CSS is always re-applied.
          physicalResourceId: cr.PhysicalResourceId.of(
            `hosted-ui-customization-${this.userPool.userPoolId}`
          ),
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: ["cognito-idp:SetUICustomization"],
            resources: [this.userPool.userPoolArn],
          }),
        ]),
        installLatestAwsSdk: false,
      }
    );
    // SetUICustomization requires the hosted UI domain to exist first.
    uiCustomization.node.addDependency(userPoolDomain);

    this.userPoolClient = this.userPool.addClient("ChatWebClient", {
      userPoolClientName: "chat-web-client",
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
        callbackUrls: DEV_CALLBACK_URLS,
        logoutUrls: DEV_LOGOUT_URLS,
      },
      authFlows: {
        userSrp: true,
      },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
    });
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, "CognitoDomain", {
      value: this.cognitoDomain,
    });
  }
}
