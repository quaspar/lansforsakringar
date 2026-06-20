import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import {
  DEV_CALLBACK_URLS,
  DEV_LOGOUT_URLS,
  EXPLICIT_AUTH_FLOWS,
  OAUTH_FLOWS,
  OAUTH_SCOPES,
} from "./auth-stack";

interface FrontendStackProps extends cdk.StackProps {
  apiEndpoint: string;
  cognitoDomain: string;
  cognitoClientId: string;
  userPool: cognito.UserPool;
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "FrontendBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, "FrontendCdn", {
      defaultBehavior: {
        origin: new origins.S3Origin(bucket),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
    });

    const appUrl = `https://${distribution.distributionDomainName}`;

    // Runtime config served as /config.js. The frontend reads these values at
    // runtime (window.__APP_CONFIG__), so the static bundle built in CI does
    // not need to know the Cognito identifiers — they are injected here at
    // deploy time. cognitoClientId is a cross-stack token; Source.data
    // substitutes it during deployment.
    const configJs = [
      "window.__APP_CONFIG__ = {",
      `  cognitoDomain: "${props.cognitoDomain}",`,
      `  cognitoClientId: "${props.cognitoClientId}",`,
      "};",
      "",
    ].join("\n");

    // Expects `npm run build` to have been run in ../frontend before deploying.
    // CI should run: cd frontend && npm ci && npm run build
    new s3deploy.BucketDeployment(this, "FrontendDeploy", {
      sources: [
        s3deploy.Source.asset("../frontend/dist"),
        s3deploy.Source.data("config.js", configJs),
      ],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ["/*"],
    });

    // Register the deployed CloudFront URL as an allowed OAuth callback/logout
    // URL on the Cognito client. The client lives in AuthStack and cannot know
    // this URL at synth time (that would be a circular dependency), so we
    // update it after the distribution exists. updateUserPoolClient replaces
    // the whole client config, so every field we want to keep is repeated here
    // using the shared constants from auth-stack.ts.
    new cr.AwsCustomResource(this, "RegisterOAuthCallbackUrls", {
      onUpdate: {
        service: "CognitoIdentityServiceProvider",
        action: "updateUserPoolClient",
        parameters: {
          UserPoolId: props.userPool.userPoolId,
          ClientId: props.cognitoClientId,
          CallbackURLs: [...DEV_CALLBACK_URLS, `${appUrl}/callback`],
          LogoutURLs: [...DEV_LOGOUT_URLS, appUrl],
          AllowedOAuthFlows: OAUTH_FLOWS,
          AllowedOAuthFlowsUserPoolClient: true,
          AllowedOAuthScopes: OAUTH_SCOPES,
          SupportedIdentityProviders: ["COGNITO"],
          ExplicitAuthFlows: EXPLICIT_AUTH_FLOWS,
        },
        // Re-run whenever the URL changes so a new distribution domain is
        // always registered.
        physicalResourceId: cr.PhysicalResourceId.of(
          `oauth-callbacks-${props.cognitoClientId}`
        ),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ["cognito-idp:UpdateUserPoolClient"],
          resources: [props.userPool.userPoolArn],
        }),
      ]),
      installLatestAwsSdk: false,
    });

    new cdk.CfnOutput(this, "FrontendUrl", {
      value: appUrl,
    });
  }
}
