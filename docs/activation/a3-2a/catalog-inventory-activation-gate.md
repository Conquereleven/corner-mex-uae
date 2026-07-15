# Catalog and inventory activation gate A3.2a

No product, variant, price, or inventory row is loaded in A3.2a.

## Entry conditions for CM-2

- founder approves the exact bounded batch and prices
- transformation checksum and source evidence are fixed
- products and variants may enter only as inactive/draft records
- physical inventory is independently counted and approved before any sellable quantity
- automatic import and automatic inventory sync remain disabled
- CornerOps planning inventory, supplier listing count, `stock-50`, and planning `stock-100` are never commercial stock

## Operational lifecycle

The operational states are `draft`, `validated`, `approved`, `published`, `sellable`, `out_of_stock`, and `retired`. They are a gate workflow, not new database enum values.

The current database product status vocabulary is `draft`, `active`, `inactive`, and `archived`. Mapping is explicit:

| Operational state | Database representation                                           | Required evidence                      |
| ----------------- | ----------------------------------------------------------------- | -------------------------------------- |
| draft             | draft                                                             | transformed but not approved           |
| validated         | draft                                                             | schema and content checks pass         |
| approved          | draft                                                             | founder approval recorded              |
| published         | active                                                            | content approved; does not imply stock |
| sellable          | active plus verified positive inventory and enabled checkout gate | physical count and price approved      |
| out_of_stock      | active plus zero available inventory                              | inventory reconciliation               |
| retired           | archived                                                          | founder retirement decision            |

`inactive` is used for a paused non-public item and is not sellable. Publication alone never creates inventory or enables checkout.
