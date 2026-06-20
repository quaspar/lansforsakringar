import * as cdk from "aws-cdk-lib";
import { AuthStack } from "../lib/auth-stack";
import { ComputeStack } from "../lib/compute-stack";
import { DataStack } from "../lib/data-stack";
import { FrontendStack } from "../lib/frontend-stack";
import { NetworkStack } from "../lib/network-stack";

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
};

const authStack = new AuthStack(app, "ChatAuthStack", { env });
const dataStack = new DataStack(app, "ChatDataStack", { env });
const networkStack = new NetworkStack(app, "ChatNetworkStack", { env });

const computeStack = new ComputeStack(app, "ChatComputeStack", {
  env,
  table: dataStack.table,
  vpc: networkStack.vpc,
  alb: networkStack.alb,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  allowedModels: [
    "anthropic.claude-3-haiku-20240307-v1:0",
    "anthropic.claude-3-5-sonnet-20241022-v2:0",
  ],
});
computeStack.addDependency(dataStack);
computeStack.addDependency(networkStack);
computeStack.addDependency(authStack);

const frontendStack = new FrontendStack(app, "ChatFrontendStack", {
  env,
  apiEndpoint: computeStack.apiEndpoint,
  cognitoDomain: authStack.cognitoDomain,
  cognitoClientId: authStack.userPoolClient.userPoolClientId,
  userPool: authStack.userPool,
});
frontendStack.addDependency(computeStack);
frontendStack.addDependency(authStack);
