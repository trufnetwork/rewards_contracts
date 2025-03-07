# Kwil Reward Distribution

### Deploy scripts

There are a couple of tasks for deploying contracts:
- `npx hardhat deploy-mock-token`, for testing mostly
- `npx hardhat deploy-factory`
- `npx hardhat deploy-clone`
- `npx hardhat deploy-safe`

If deploy to a new network, first we need to `deploy-factory`, then `deploy-clone` for each new escrow contract.
If deploy to existing network, we only need to `deploy-clone`.

> NOTE: use `--help` for arguments and flags.

### Documentations

- [overview](./docs/README.md)
- [proxy contract](./docs/RewardDistributor.md)

### Audits

- [by HashEx](./docs/RewardDistributor_HashEx_Audit.pdf)