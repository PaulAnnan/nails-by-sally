// create-tables.js — Run once: node create-tables.js
import dotenv from "dotenv";
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function createTable(params) {
  try {
    // Check if table already exists
    await client.send(
      new DescribeTableCommand({ TableName: params.TableName })
    );
    console.log(`✅ Table "${params.TableName}" already exists — skipping.`);
  } catch (err) {
    if (err.name === "ResourceNotFoundException") {
      await client.send(new CreateTableCommand(params));
      console.log(`✅ Table "${params.TableName}" created successfully.`);
    } else {
      throw err;
    }
  }
}

async function main() {
  // 1. Admin Users table
  await createTable({
    TableName: "NailsBySally_AdminUsers",
    AttributeDefinitions: [{ AttributeName: "email", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST",
  });

  // 2. Appointments table + DateIndex GSI
  await createTable({
    TableName: "NailsBySally_Appointments",
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "date", AttributeType: "S" },
    ],
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    GlobalSecondaryIndexes: [
      {
        IndexName: "DateIndex",
        KeySchema: [{ AttributeName: "date", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  });

  console.log("\n🎉 All done! You can now start your server with: node server.js");
}

main().catch((err) => {
  console.error("❌ Error creating tables:", err.message);
  process.exit(1);
});
