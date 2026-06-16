import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly alb: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "ChatVpc", {
      availabilityZones: [
        `${this.region}a`,
        `${this.region}b`,
      ],
      natGateways: 1,
    });

    this.alb = new elbv2.ApplicationLoadBalancer(this, "ChatAlb", {
      vpc: this.vpc,
      internetFacing: true,
    });

    new cdk.CfnOutput(this, "AlbDns", {
      value: this.alb.loadBalancerDnsName,
    });
  }
}
