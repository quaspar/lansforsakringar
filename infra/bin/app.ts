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
    // Claude 4.x and Llama 3.3 are invoked through cross-region inference
    // profiles (the `us.` prefix), not on-demand bare model IDs — invoking the
    // bare ID returns "on-demand throughput isn't supported". gpt-oss-120b is
    // on-demand only and has no inference profile, so it stays unprefixed.
    "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    "us.anthropic.claude-sonnet-4-6",
    "us.meta.llama3-3-70b-instruct-v1:0",
    "openai.gpt-oss-120b-1:0",
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
