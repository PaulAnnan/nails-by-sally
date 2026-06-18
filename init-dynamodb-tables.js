// scripts/init-dynamodb-tables.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  CreateTableCommand,
  DescribeTableCommand,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function tableExists(tableName) {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error.name === "ResourceNotFoundException") {
      return false;
    }
    throw error;
  }
}

async function createAppointmentsTable() {
  const tableName = "NailsBySally_Appointments";

  if (await tableExists(tableName)) {
    console.log(`✓ Table ${tableName} already exists`);
    return;
  }

  const params = {
    TableName: tableName,
    KeySchema: [
      { AttributeName: "id", KeyType: "HASH" }, // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "date", AttributeType: "S" },
      { AttributeName: "email", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "DateIndex",
        KeySchema: [{ AttributeName: "date", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
      {
        IndexName: "EmailIndex",
        KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  try {
    await client.send(new CreateTableCommand(params));
    console.log(`✓ Created table ${tableName}`);
    console.log("  Waiting for table to be active...");
    
    // Wait for table to be active
    let isActive = false;
    while (!isActive) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const result = await client.send(new DescribeTableCommand({ TableName: tableName }));
      isActive = result.Table.TableStatus === "ACTIVE";
    }
    console.log(`  Table ${tableName} is now active`);
  } catch (error) {
    console.error(`✗ Error creating table ${tableName}:`, error.message);
    throw error;
  }
}

async function createAdminUsersTable() {
  const tableName = "NailsBySally_AdminUsers";

  if (await tableExists(tableName)) {
    console.log(`✓ Table ${tableName} already exists`);
    return;
  }

  const params = {
    TableName: tableName,
    KeySchema: [
      { AttributeName: "email", KeyType: "HASH" }, // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: "email", AttributeType: "S" },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  try {
    await client.send(new CreateTableCommand(params));
    console.log(`✓ Created table ${tableName}`);
    console.log("  Waiting for table to be active...");
    
    // Wait for table to be active
    let isActive = false;
    while (!isActive) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const result = await client.send(new DescribeTableCommand({ TableName: tableName }));
      isActive = result.Table.TableStatus === "ACTIVE";
    }
    console.log(`  Table ${tableName} is now active`);
  } catch (error) {
    console.error(`✗ Error creating table ${tableName}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log("Initializing DynamoDB tables...\n");

  try {
    // List existing tables
    const listResult = await client.send(new ListTablesCommand({}));
    console.log("Existing tables:", listResult.TableNames.join(", ") || "none");
    console.log("");

    await createAppointmentsTable();
    await createAdminUsersTable();

    console.log("\n✓ All tables initialized successfully!");
  } catch (error) {
    console.error("\n✗ Failed to initialize tables:", error);
    process.exit(1);
  }
}

main();
