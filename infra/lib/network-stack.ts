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
      natGateways: 0,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC },
        // Keep the name "Private" so CDK generates the same logical IDs as
        // the existing PRIVATE_WITH_EGRESS subnets. Only the route tables
        // change (NAT route removed); the subnet resources are unchanged,
        // which avoids breaking the cross-stack exports ComputeStack imports.
        { name: "Private", subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    this.alb = new elbv2.ApplicationLoadBalancer(this, "ChatAlb", {
      vpc: this.vpc,
      internetFacing: true,
    });

    // Transitional: preserve the private-subnet CloudFormation exports that
    // the currently-deployed ComputeStack still imports via Fn::ImportValue.
    // CDK stopped auto-generating these outputs once ComputeStack switched to
    // public subnets, so CloudFormation would try to delete them — which it
    // can't while the live stack still imports them.  Explicit outputs with
    // the same logical IDs keep the exports alive through this deploy.
    // Once this deploy completes (ComputeStack on public subnets), nothing
    // imports these anymore and the next deploy can remove them cleanly.
    new cdk.CfnOutput(this, "ExportsOutputRefChatVpcPrivateSubnet1Subnet72514D4CD14686E6", {
      value: this.vpc.isolatedSubnets[0].subnetId,
      exportName: `${this.stackName}:ExportsOutputRefChatVpcPrivateSubnet1Subnet72514D4CD14686E6`,
    });
    new cdk.CfnOutput(this, "ExportsOutputRefChatVpcPrivateSubnet2SubnetAF09A63C174901C7", {
      value: this.vpc.isolatedSubnets[1].subnetId,
      exportName: `${this.stackName}:ExportsOutputRefChatVpcPrivateSubnet2SubnetAF09A63C174901C7`,
    });

    new cdk.CfnOutput(this, "AlbDns", {
      value: this.alb.loadBalancerDnsName,
    });
  }
}
