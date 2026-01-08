# Payer Restrictions API

## List active restrictions for a payer

```
GET /api/payers/{payerId}/restrictions
```

- Requires authentication and org membership.
- Returns only active (non-expired) restrictions for orgs the user belongs to.

## Clear a restriction (admin)

```
DELETE /api/payers/{payerId}/restrictions/{restrictionId}
```

- Requires authentication, `settings.write` permission (org_admin/org_manager/platform_admin), and membership in the restriction's org.
- Removes the restriction and its linked methods.
- Returns 404 if the restriction does not belong to the payer or does not exist.
- Returns 403 if the user is not a member of the restriction's org or lacks permissions.

Example:

```bash
curl -X DELETE \
  -H "Authorization: Bearer <access_token>" \
  https://<host>/api/payers/<payer_uuid>/restrictions/<restriction_uuid>
```
