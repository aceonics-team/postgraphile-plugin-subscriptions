# Postgraphile Subscription Plugin

This plugin adds subscriptions by default per table in your postGraphile schema; e.g.
`user` table gets subscription as `onAllUsersMutation` and depending on primary/unique keys `onUserMutationById` && `onUserMutationByEmail`. This plugin is not dependent on `@graphile/supporter` or `@graphile/pro` package. It uses `graphql-subscriptions` internally. 

Postgraphile does not have build-in subscriptions so currently this plugin can be used with apollo-server, as it has built-in subscriptions. Check out example for more info. 

This is currently in alpha stage and has few issues which would resolved in near future.

## Features
With each mutation on table subscription returns following graphql result
* clientMutationId: Exact clientMutationId used while performing mutation.
* mutation: Type or mutation, value can be CREATED, UPDATED or DELETED.
* node: Updated values for record after performing mutation.
* previousValues: Previous values for record before performing mutation. 
* changedFields: List of column names affected due to mutation.
* Allows subscribing to single record
* Allows subscribing to specific mutation. 

## Install
For npm
```
npm install postgraphile-plugin-subscriptions --save
```
For yarn
```
yarn add postgraphile-plugin-subscriptions
```

## Usage

### Postgres Database
Create table
```
CREATE TABLE "users"(
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL unique,
  "firstName" TEXT,
  "lastName" TEXT,
  "mobile" TEXT,
  "role" USER_ROLE NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now(),
  "archivedAt" TIMESTAMPTZ
);
```

### Server
Create apollo server and add postgraphile schema
```
const pg = require("pg");
const { ApolloServer } = require("apollo-server");
const { makeSchemaAndPlugin } = require("postgraphile-apollo-server");
const PgSubscriptionsPlugin = require("postgraphile-plugin-subscriptions");

const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const { schema, plugin } = await makeSchemaAndPlugin(
    pgPool,
    'public',
    {
      appendPlugins: [
        PgSubscriptionsPlugin
      ],
    }
  );

  const server = new ApolloServer({
    schema,
    plugins: [plugin],
    tracing: true,
    debug: true
  });

  const { url } = await server.listen();
  console.log(`🚀 Server ready at ${url}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
```

### Client or GraphQL Playground
Subscribe to onAllUsersMutation (this will be triggered when any user is created, updated or deleted)
```
subscription {
  onAllUsersMutation {
    clientMutationId
    mutation
    user {
      id
      firstName
      lastName
      email
      updatedAt
      createdAt
    }
    previousValues {
      id
      firstName
      lastName
      email
      updatedAt
      createdAt
    }
    changedFields 
  }
}
```

Perform Mutation
```
mutation {
  updateUserById(input: {
    clientMutationId: "my_custom_mutation_id"
    id: "e673ad33-dbd7-45a7-b272-3fefa25b4cba"
    userPatch: {
      firstName: "John",
      lastName: "Doe",
      email:"john@example.com",
    }
  }) {
    clientMutationId
    user {
      id
    }
  }
}
```

Subscription Output
```
{
  "data": {
    "onAllUsersMutation": {
      "clientMutationId": "my_custom_mutation_id",
      "mutation": "UPDATED",
      "user": {
        "id": "e673ad33-dbd7-45a7-b272-3fefa25b4cba",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "updatedAt": "Mon Dec 24 2018 12:55:20 GMT+0530 (GMT+05:30)",
        "createdAt": "Mon Dec 24 2018 12:50:14 GMT+0530 (GMT+05:30)"
      },
      "previousValues": {
        "id": "e673ad33-dbd7-45a7-b272-3fefa25b4cba",
        "firstName": "Jen",
        "lastName": "Doe",
        "email": "jen@example.com",
        "updatedAt": "Mon Dec 24 2018 12:50:14 GMT+0530 (GMT+05:30)",
        "createdAt": "Mon Dec 24 2018 12:50:14 GMT+0530 (GMT+05:30)"
      },
      "changedFields": [
        "firstName",
        "email"
        "updatedAt"
      ]
    }
  }
}
```

### Subscribing to specific record
This will trigger only if user with email "jen@example.com" is updated or deleted.
```
subscription {
  onUserMutationByEmail(email:"jen@example.com") {
   clientMutationId
    mutation
    user {
      id
      firstName
      lastName
      email
      updatedAt
      createdAt
    }
    previousValues {
      id
      firstName
      lastName
      email
      updatedAt
      createdAt
    }
    changedFields 
  }
}
```

### Subscribing to specific events
This will trigger if any user is created or updated, but not if deleted.
```
subscription {
  onUserMutationByEmail(mutation_in: [
    CREATED
    UPDATED
  ]) {
   clientMutationId
    mutation
    user {
      id
      firstName
      lastName
      email
      updatedAt
      createdAt
    }
    previousValues {
      id
      firstName
      lastName
      email
      updatedAt
      createdAt
    }
    changedFields 
  }
}
```

### Subscribing to specific events of specific record
This will only trigger when user with id "e673ad33-dbd7-45a7-b272-3fefa25b4cba" is updated.
```
subscription {
  onUserMutationByEmail(id: "e673ad33-dbd7-45a7-b272-3fefa25b4cba", mutation_in: [
    UPDATED
  ]) {
   clientMutationId
    mutation
    user {
      id
      firstName
      lastName
      email
      updatedAt
      createdAt
    }
    previousValues {
      id
      firstName
      lastName
      email
      updatedAt
      createdAt
    }
    changedFields 
  }
}
```