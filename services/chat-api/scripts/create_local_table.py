#!/usr/bin/env python3
"""Create the DynamoDB table locally for development."""
import asyncio
import os

import aioboto3


async def main() -> None:
    endpoint = os.getenv("DYNAMO_ENDPOINT", "http://localhost:8000")
    table_name = os.getenv("DYNAMO_TABLE_NAME", "chat-service")
    region = os.getenv("AWS_REGION", "us-east-1")

    session = aioboto3.Session()
    async with session.client(
        "dynamodb",
        region_name=region,
        endpoint_url=endpoint,
        aws_access_key_id="dummy",
        aws_secret_access_key="dummy",
    ) as client:
        try:
            await client.create_table(
                TableName=table_name,
                KeySchema=[
                    {"AttributeName": "PK", "KeyType": "HASH"},
                    {"AttributeName": "SK", "KeyType": "RANGE"},
                ],
                AttributeDefinitions=[
                    {"AttributeName": "PK", "AttributeType": "S"},
                    {"AttributeName": "SK", "AttributeType": "S"},
                ],
                BillingMode="PAY_PER_REQUEST",
            )
            print(f"Table '{table_name}' created successfully.")
        except client.exceptions.ResourceInUseException:
            print(f"Table '{table_name}' already exists.")


if __name__ == "__main__":
    asyncio.run(main())
