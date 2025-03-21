# Kwil erc20-bridge contracts

### Note on Terminology Changes

During the development of the smart contracts, the terms 'reward' and 'RewardDistributor' were used throughout the
project and referenced in the audit report.

As the project evolved, we adopted the term 'erc20-bridge' in most of the codebase and documentation. To maintain
consistency with the audit report, we retained the original terminology in this repository. Below is a mapping of terms
used in the context of the erc20-bridge:

- **RewardDistributor:** Functions as the 'escrow' contract.
- **reward:** Refers to the 'tokens' claimable in the 'escrow' contract.
- **poster:** Acts as the 'relayer'.
- **claim rewards:** Equivalent to 'claim tokens'.


### Documentations

- [overview](./docs/overview)
- [proxy contract](./docs/RewardDistributor.md)
- [deploy contracts](./docs/tasks.md)
- [run poster service](./docs/poster.md)

### Audits

- [by HashEx](./docs/RewardDistributor_HashEx_Audit.pdf)