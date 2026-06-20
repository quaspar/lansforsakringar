import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
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
    this.userPool.addDomain("CognitoDomain", {
      cognitoDomain: { domainPrefix },
    });
    this.cognitoDomain = `https://${domainPrefix}.auth.${this.region}.amazoncognito.com`;

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
