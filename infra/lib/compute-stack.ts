import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface ComputeStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  vpc: ec2.Vpc;
  alb: elbv2.ApplicationLoadBalancer;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  allowedModels: string[];
}

export class ComputeStack extends cdk.Stack {
  public readonly apiEndpoint: string;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const cluster = new ecs.Cluster(this, "ChatCluster", {
      vpc: props.vpc,
    });

    const taskRole = new iam.Role(this, "ChatTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    props.table.grantReadWriteData(taskRole);
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: props.allowedModels.map(
          (m) => `arn:aws:bedrock:${this.region}::foundation-model/${m}`
        ),
      })
    );

    const logGroup = new logs.LogGroup(this, "ChatApiLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const taskDef = new ecs.FargateTaskDefinition(this, "ChatTaskDef", {
      memoryLimitMiB: 512,
      cpu: 256,
      taskRole,
    });

    taskDef.addContainer("ChatApiContainer", {
      image: ecs.ContainerImage.fromAsset("../services/chat-api"),
      portMappings: [{ containerPort: 8000 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "chat-api",
        logGroup,
      }),
      environment: {
        AWS_REGION: this.region,
        DYNAMO_TABLE_NAME: props.table.tableName,
        COGNITO_USER_POOL_ID: props.userPool.userPoolId,
        COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
        COGNITO_REGION: this.region,
        ALLOWED_MODELS: props.allowedModels.join(","),
        REPOSITORY: "dynamo",
        PROVIDER: "bedrock",
        AUTH_MODE: "cognito",
      },
    });

    const service = new ecs.FargateService(this, "ChatService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: false,
    });

    const listener = props.alb.addListener("ChatListener", {
      port: 80,
      open: true,
    });

    listener.addTargets("ChatTargets", {
      port: 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: "/health",
        interval: cdk.Duration.seconds(30),
      },
    });

    this.apiEndpoint = `http://${props.alb.loadBalancerDnsName}`;

    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: this.apiEndpoint,
    });
  }
}
