# Buildium Webhook Contract Samples

## General webhook (app `buildium-webhook`)

Valid payload:

```json
{
  "Events": [
    {
      "Id": "evt-100",
      "EventType": "PropertyCreated",
      "EventDate": "2024-01-01T00:00:00Z",
      "EntityId": 42,
      "Data": {
        "EventType": "PropertyCreated"
      }
    }
  ]
}
```

Malformed body (missing `Events` array):

```json
{
  "EventType": "PropertyCreated",
  "EventDate": "2024-01-01T00:00:00Z",
  "EntityId": 42
}
```

Unsupported `EventType` (rejected with 400):

```json
{
  "Events": [
    {
      "Id": "evt-unsupported",
      "EventType": "MadeUpEvent",
      "EventDate": "2024-01-01T00:00:00Z",
      "EntityId": 1
    }
  ]
}
```

## Lease transaction webhook (`buildium-lease-transactions`)

Valid payload (with optional credentials override):

```json
{
  "Events": [
    {
      "Id": "evt-lease-1",
      "EventType": "LeaseTransactionCreated",
      "EventDate": "2024-02-02T10:00:00Z",
      "EntityId": 555,
      "LeaseId": 123,
      "TransactionId": 555
    }
  ],
  "credentials": {
    "baseUrl": "https://apisandbox.buildium.com/v1",
    "clientId": "CLIENT_ID",
    "clientSecret": "CLIENT_SECRET"
  }
}
```

Unsupported event routed to skip/dead-letter with metrics:

```json
{
  "Events": [
    {
      "Id": "evt-lease-unsupported",
      "EventType": "VendorCreated",
      "EventDate": "2024-02-02T10:00:00Z",
      "EntityId": 44
    }
  ]
}
```
