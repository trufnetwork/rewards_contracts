// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

//import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RewardDistributor is ReentrancyGuard {
    // isSigner maps all allowed signers to true
    mapping(address => bool) public isSigner;
    // signers is the list of allowed signers
    address[] private signers;
    // threshold is the minimum number of signatures required to postReward/updatePosterFee/updateSigners
    uint8 public threshold;
    // maxAllowedSigners is the maximum number of signers, so there will be a gas cap
    uint8 constant public maxAllowedSigners = 20;
    // rewardPoster maps a reward hash(merkle tree root) to the address that posted the root
    mapping(bytes32 => address) public rewardPoster;
    // isRewardClaimed maps a reward hash (merkle tree root) to the leaf hash of the Merkle tree to whether it has been claimed
    mapping(bytes32 => mapping(bytes32 => bool)) public isRewardClaimed;
    // posterFee is the fee that rewardClaimer will pay to the 'rewardPoster' on each claim
    uint256 public posterFee;
    // posterFeeNonce is the nonce for updating the posterFee.
    // It is incremented each time the posterFee is updated.
    uint256 public posterFeeNonce;
    // postRewardNonce is the nonce for posting new reward.
    // It is incremented each time a new reward is posted
    // to prevent replay attacks and to ensure that the reward root is unique.
    uint256 public postRewardNonce;
    // rewardToken is the address of the ERC20 token used for rewards
    IERC20 immutable public rewardToken;
    // postedRewards is the total amount of rewards posted to the contract.
    // It can never exceed the total balance of the token owned by the contract.
    uint256 public postedRewards;

    event RewardPosted(bytes32 root, uint256 amount, address poster);
    event RewardClaimed(address recipient, uint256 amount, address claimer);
    event PosterFeeUpdated(uint256 newFee, uint256 nonce);
    event SignersUpdated(address[] newSigners, uint8 newThreshold);

    constructor(address[] memory _allowedSigners, uint8 _threshold, uint256 _posterFee, IERC20 _rewardToken) {
        require(_allowedSigners.length <= maxAllowedSigners, "Too many signers");
        require(_threshold <= _allowedSigners.length, "Threshold must be less than or equal to the number of signers");
        require(_threshold > 0, "Threshold must be greater than 0");

        for (uint256 i; i < _allowedSigners.length; i++) {
            require(_allowedSigners[i] != address(0), "Invalid signer");
            require(!isSigner[_allowedSigners[i]], "Duplicate signer");

            isSigner[_allowedSigners[i]] = true;
        }

        threshold = _threshold;
        posterFee = _posterFee;
        rewardToken = _rewardToken;
        signers = _allowedSigners;
    }

    /// @notice This function adds new reward record to the contract.
    /// It requires at least threshold signatures from allowed signers.
    /// @dev It's called by network rewardPoster.
    function postReward(bytes32 rewardRoot, uint256 rewardAmount, bytes[] calldata signatures) external {
        require(rewardAmount > 0, "Total amount must be greater than 0");
        require(signatures.length >= threshold, "Not enough signatures");
        require(rewardPoster[rewardRoot] == address(0), "Reward root already posted");
        require(rewardToken.balanceOf(address(this)) >= postedRewards + rewardAmount, "Insufficient contract balance for reward amount");

        // we don't need nonces here because the reward root is unique, and it would (for all intents and purposes)
        // be impossible to replay the same reward root with a different total amount
        bytes32 messageHash = keccak256(abi.encode(rewardRoot, rewardAmount, postRewardNonce, address(this)));
        address[] memory memSigners = new address[](signatures.length);
        for (uint256 i; i < signatures.length; i++) {
            // MessageHashUtils.toEthSignedMessageHash to prepend EIP-191 prefix, since client uses `personal_sign`
            address signer = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(messageHash), signatures[i]);
            require(isSigner[signer], "Invalid signer");
            memSigners[i] = signer;
        }

        // verify that the signers are unique
        // This is needed since mappings cannot be used in memory in Solidity
        for (uint256 i; i < memSigners.length; i++) {
            for (uint256 j = i + 1; j < memSigners.length; j++) {
                require(memSigners[i] != memSigners[j], "Duplicate signer");
            }
        }

        rewardPoster[rewardRoot] = msg.sender;
        postedRewards += rewardAmount;
        postRewardNonce++;

        emit RewardPosted(rewardRoot, rewardAmount, msg.sender);
    }

    /// @notice This allows a user to claim reward by providing the leaf data and
    /// correspond Merkle proof, on behalf of the recipient.
    /// The reward must be posted and not already claimed.
    /// @dev There is no reimbursement for whoever call this function, it's settled off-chain.
    /// @dev This is only way to transfer reward token out of this contract.
    /// @dev This is called by a rewardClaimer, not necessarily the recipient.
    function claimReward(address recipient, uint256 amount, bytes32 rewardRoot, bytes32[] calldata proof) external payable nonReentrant {
        address payable poster = payable(rewardPoster[rewardRoot]);
        require(poster != address(0), "Reward root not posted");

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(recipient, amount, address(this)))));
        require(!isRewardClaimed[rewardRoot][leaf], "Reward already claimed");

        // verify the Merkle proof
        require(MerkleProof.verify(proof, rewardRoot, leaf), "Invalid proof");

        // Optimized payment and refund logic in claimReward
        require(msg.value >= posterFee, "Insufficient payment for poster");

        // Calculate any excess ETH to refund to the sender
        uint256 excess = msg.value - posterFee;

        // Use call to transfer ETH to the poster (recommended for flexibility with gas limits)
        (bool success, ) = poster.call{value: posterFee}("");
        
        require(success, "Poster reward transfer failed");

        // Refund any excess ETH to the caller if applicable
        if (excess > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: excess}("");
            require(refundSuccess, "Refund failed");
        }

        // claim the reward
        isRewardClaimed[rewardRoot][leaf] = true;
        postedRewards -= amount;

        require(rewardToken.transfer(recipient, amount), "Token transfer failed");
        emit RewardClaimed(recipient, amount, msg.sender);
    }

    // This function updates the fee that rewardPoster will be paid.
    // It must be signed by at least threshold signers.
    function updatePosterFee(uint256 newFee, bytes[] calldata signatures) external {
        require(newFee > 0, "Fee must be greater than 0");
        require(signatures.length >= threshold, "Not enough signatures");

        bytes32 messageHash = keccak256(abi.encode(newFee, posterFeeNonce, address(this)));
        for (uint256 i; i < signatures.length; i++) {
            address signer = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(messageHash), signatures[i]);
            require(isSigner[signer], "Invalid signer");
        }

        posterFee = newFee;
        posterFeeNonce++;

        emit PosterFeeUpdated(newFee, posterFeeNonce -1);
    }

    // updateSigners updates the list of allowed signers and the threshold.
    // It must be signed by at least threshold signers.
    function updateSigners(address[] calldata newSigners, uint8 newThreshold, bytes[] calldata signatures) external {
        require(newSigners.length <= maxAllowedSigners, "Too many signers");
        require(newThreshold <= newSigners.length, "Threshold must be less than or equal to the number of signers");
        require(newThreshold > 0, "Threshold must be greater than 0");
        require(signatures.length >= threshold, "Not enough signatures");

        bytes32 messageHash = keccak256(abi.encode(newSigners, newThreshold, address(this)));
        for (uint256 i; i < signatures.length; i++) {
            address signer = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(messageHash), signatures[i]);
            require(isSigner[signer], "Invalid signer");
        }

        for (uint256 i; i < signers.length; i++) {
            delete isSigner[signers[i]];
        }

        for (uint256 i; i < newSigners.length; i++) {
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
        return rewardToken.balanceOf(address(this)) - postedRewards;
    }

    // Fallback function to prevent accidental Ether transfers
    receive() external payable {
        revert("Ether transfers not allowed");
    }

    // Fallback function to prevent accidental Ether transfers
    fallback() external payable {
        revert("Ether transfers not allowed");
    }
}

//// for echidna
//contract TestRewardDistributor {
//    // Extracted function to return the signers array
//    function _getSigners() internal pure returns (address[] memory) {
//        address[] memory addrs = new address[](3);
//        addrs[0] = 0x6Ecbe1DB9EF729CBe972C83Fb886247691Fb6beb;
//        addrs[1] = 0xE36Ea790bc9d7AB70C55260C66D52b1eca985f84;
//        addrs[2] = 0xE834EC434DABA538cd1b9Fe1582052B880BD7e63;
//        return addrs;
//    }
//
////    // Constructor to initialize the parent contract with the necessary parameters
////    constructor() RewardDistributor(
////    _getSigners(),
////    2,
////    4000,
////    IERC20(0x1D7022f5B17d2F8B695918FB48fa1089C9f85401)
////    ) {}
//
//RewardDistributor private rd;
//
//    constructor() {
//    rd = RewardDistributor(
//    _getSigners(),
//    2,
//    4000,
//    IERC20(0x1D7022f5B17d2F8B695918FB48fa1089C9f85401)
//    );
//    }
//
////    function echidna_threshold_less_equal_than_signers() public view returns (bool) {
////        return threshold < signers.length;
////    }
////
////    function echidna_token_wont_change() public view returns (bool) {
////        return token == IERC20(0x1dC4c1cEFEF38a777b15aA20260a54E584b16C48);
////    }
//}
