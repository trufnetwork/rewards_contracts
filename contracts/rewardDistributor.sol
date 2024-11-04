// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract RewardDistributor is ReentrancyGuard {
    // isSigner maps all allowed signers to true
    mapping(address => bool) private isSigner;
    // signers is the list of allowed signers
    address[] public signers;
    
    // threshold is the minimum number of signatures required to execute a transaction
    uint8 public threshold;
    // rewardRoots maps a reward hash to the address that posted the root
    mapping(bytes32 => address) public rewardRoots;
    // claimedRewards maps a reward hash to the leaf hash of the Merkle tree to whether it has been claimed
    mapping(bytes32 => mapping(bytes32 => bool)) public claimedRewards;
    // posterReward is the gwei amount that each withdrawer will pay to the poster
    uint256 public posterReward;
    // rewardNonce is the nonce for updating the reward amount.
    // It is incremented each time the reward amount is updated
    // to prevent replay attacks.
    uint256 public rewardNonce;
    // rootNonce is the nonce for updating the reward root.
    // It is incremented each time the reward root is updated
    // to prevent replay attacks and to ensure that the reward root is unique.
    uint256 public rootNonce;

    // token is the address of the ERC20 token used for rewards
    IERC20 public token;
    // totalPostedRewards is the total amount of rewards posted to the contract.
    // It can never exceed the total balance of the token owned by the contract.
    uint256 public totalPostedRewards;

    event RewardRootPosted(bytes32 rewardRoot, uint256 totalAmount);
    event RewardClaimed(address recipient, address claimer,  uint256 amount);
    event RewardRateUpdated(uint256 newReward, uint256 nonce);
    event SignersUpdated(address[] newSigners, uint8 newThreshold);

    constructor(address[] memory _allowedSigners, uint8 _threshold, uint256 _reward, IERC20 _token) {
        // MAYBE ensure len(_allowedSigners) <= ?
        require(_threshold <= _allowedSigners.length, "Threshold must be less than or equal to the number of signers");
        require(_threshold > 0, "Threshold must be greater than 0");
        for (uint256 i = 0; i < _allowedSigners.length; i++) {
            require(_allowedSigners[i] != address(0), "Invalid signer");
            require(!isSigner[_allowedSigners[i]], "Duplicate signer");

            isSigner[_allowedSigners[i]] = true;
        }
        threshold = _threshold;
        posterReward = _reward;
        token = _token;
        signers = _allowedSigners;
    }

    // postRewardRoot adds a new reward root to the contract.
    // It must be signed by at least threshold signers.
    function postRewardRoot(bytes32 rewardRoot, uint256 totalAmount, bytes[] memory signatures) external {
        require(totalAmount > 0, "Total amount must be greater than 0");
        require(signatures.length >= threshold, "Not enough signatures");
        require(rewardRoots[rewardRoot] == address(0), "Reward root already posted");
        require(token.balanceOf(address(this)) >= totalPostedRewards + totalAmount, "Reward amount exceeds contract balance");

        // we don't need nonces here because the reward root is unique, and it would (for all intents and purposes)
        // be impossible to replay the same reward root with a different total amount
        // yaiba: why reward root is unique?
        bytes32 messageHash = keccak256(abi.encode(rewardRoot, totalAmount, rootNonce, address(this)));
//        console.logBytes32(rewardRoot);
//        console.logUint(totalAmount);
//        console.logUint(rewardNonce);
//        console.logAddress(address(this));
//        console.logBytes32(messageHash);
//        console.logBytes32(MessageHashUtils.toEthSignedMessageHash(messageHash));
//        console.log("+++++++++++");
        address[] memory memSigners = new address[](signatures.length);
        for (uint256 i = 0; i < signatures.length; i++) {
//            console.log("pass sig-");
//            console.logBytes(signatures[i]);
            // MessageHashUtils.toEthSignedMessageHash to prepend EIP-191 prefix, since client use `personal_sign`
            address signer = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(messageHash), signatures[i]);
//            console.logAddress(signer);
            require(isSigner[signer], "Invalid signer");
//            console.log("pass sig+");
            memSigners[i] = signer;
        }

        // verify that the signers are unique
        // This is needed since mappings cannot be used in memory in Solidity
        for (uint256 i = 0; i < memSigners.length; i++) {
            for (uint256 j = i + 1; j < memSigners.length; j++) {
                require(memSigners[i] != memSigners[j], "Duplicate signer");
            }
        }

        rewardRoots[rewardRoot] = msg.sender;
        totalPostedRewards += totalAmount;
        rootNonce++;

        emit RewardRootPosted(rewardRoot, totalAmount);
    }

    // claimReward allows a user to claim a reward by providing a leaf hash and a Merkle proof.
    // The reward must be posted and not already claimed.
    // The proof should be pre-sorted.
    function claimReward(address recipient, uint256 amount, bytes32 rewardRoot, bytes32[] memory proof) external payable nonReentrant {
        address payable poster = payable(rewardRoots[rewardRoot]);
        require(poster != address(0), "Reward root not posted");

        // get the leaf hash
        // yaiba: seems whoever have access to original Merkle tree can claim the reward?
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(recipient, amount, address(this)))));
//        console.logAddress(recipient);
//        console.logUint(amount);
//        console.logAddress(address(this));
//        console.logBytes32(leaf);
        require(!claimedRewards[rewardRoot][leaf], "Reward already claimed");

        // verify the Merkle proof
        require(MerkleProof.verify(proof, rewardRoot, leaf), "Invalid proof");

        // Optimized payment and refund logic in claimReward
        require(msg.value >= posterReward, "Insufficient payment for poster");

        // Calculate any excess ETH to refund to the sender
        uint256 excess = msg.value - posterReward;

        // Use call to transfer ETH to the poster (recommended for flexibility with gas limits)
        (bool success, ) = poster.call{value: posterReward}("");
        
        require(success, "Poster reward transfer failed");

        // Refund any excess ETH to the caller if applicable
        if (excess > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: excess}("");
            require(refundSuccess, "Refund failed");
        }

        // claim the reward
        claimedRewards[rewardRoot][leaf] = true;
        totalPostedRewards -= amount;
        // yaiba: send token to msg.sender, allow claim as long as you have the proof
        require(token.transfer(msg.sender, amount), "Token transfer failed");

        emit RewardClaimed(recipient, msg.sender, amount);
    }

    // updatePosterReward updates the reward amount that each withdrawer will pay to the poster.
    // It must be signed by at least threshold signers.
    function updatePosterReward(uint256 newReward, bytes[] memory signatures) external {
        require(newReward > 0, "Reward must be greater than 0");
        //require(nonce == rewardNonce, "Invalid nonce"); // seems not necessary, as signatures will fail
        require(signatures.length >= threshold, "Not enough signatures");

        bytes32 messageHash = keccak256(abi.encode(newReward, rewardNonce, address(this)));
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(messageHash), signatures[i]);
            require(isSigner[signer], "Invalid signer");
        }

        posterReward = newReward;
        uint256 curRewardNonce = rewardNonce;
        rewardNonce++;

        emit RewardRateUpdated(newReward, curRewardNonce);
    }

    // updateSigners updates the list of allowed signers and the threshold.
    // It must be signed by at least threshold signers.
    function updateSigners(address[] memory newSigners, uint8 newThreshold, bytes[] memory signatures) external {
        // MAYBE ensure len(newSigners) <= ?
        require(newThreshold <= newSigners.length, "Threshold must be less than or equal to the number of signers");
        require(newThreshold > 0, "Threshold must be greater than 0");

        require(signatures.length >= threshold, "Not enough signatures");

        bytes32 messageHash = keccak256(abi.encode(newSigners, newThreshold, address(this)));
        for (uint256 i = 0; i < signatures.length; i++) {
//            address signer = ECDSA.recover(messageHash, signatures[i]);
            address signer = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(messageHash), signatures[i]);
            require(isSigner[signer], "Invalid signer");
        }

        for (uint256 i = 0; i < signers.length; i++) {
//            isSigner[signers[i]] = false; // maybe use delete isSigner[signers[i]] ?
            delete isSigner[signers[i]];
        }

        for (uint256 i = 0; i < newSigners.length; i++) {
            require(newSigners[i] != address(0), "Invalid new signer");
            require(!isSigner[newSigners[i]], "Duplicate new signer");

            isSigner[newSigners[i]] = true;
        }

        signers = newSigners;
        threshold = newThreshold;

        emit SignersUpdated(newSigners, newThreshold);
    }

    // unpostedRewards is the total amount of rewards that are owned by the contract
    // and have not been posted in a reward root.
    function unpostedRewards() public view returns (uint256) {
        return token.balanceOf(address(this)) - totalPostedRewards;
    }
}