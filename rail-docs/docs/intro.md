---
sidebar_position: 1
---

# Rail

## Fundamentals

Rail provides a Vault Factory Contract that generates new Vault Contracts, which are used to manage the pooling of tokens and distribution of revenue. Each Vault has an Operator who is the owner of the smart contract, and is responsible for setting the Operator fee, changing metadata, transferring ownership, and assigning Join-part agents.

Beneficiaries join a Vault and become eligible to receive a share of the incoming revenue. The revenue is tracked by the Vault Contract, and the Beneficiary weighting variable determines how many tokens each Beneficiary is eligible for in relation to others.

Rail charges a Protocol fee, which is a percentage of every incoming transaction, and is received by the Protocol fee oracle smart contract, owned by Rail. The Protocol beneficiary address receives the Protocol fee.

Join-part agents have the power to add and remove/deactivate members from the Vault, and by default, it is the admin and the address of the default Join server.

Rail also provides a Join server repository on GitHub that serves as a starting point for automating beneficiary joins to a Vault, and a default Join server run by Rail that handles automated joins via a shared secret.

Finally, Rail SDK is an npm package that helps integrate the Vault Contracts into a node environment. Overall, Rail appears to be a platform that facilitates the pooling of tokens and revenue sharing among multiple parties through the use of smart contracts.
