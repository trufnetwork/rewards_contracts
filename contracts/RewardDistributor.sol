// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

//import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/*
 * @title RewardDistributor - Kwil Reward distribution contract.
 * @dev Different roles involved:
 *      - Signer: Kwil network reward signer service. It signs new reward on Kwil network, and upload the signature
 *                onto Kwil network, which will be used by Poster to propose/comfirm/execute tx in GnosisSafe.
 *      - Safe: GnosisSafe wallet. It's the admin role to update contract's state, through `postReward`/`updatePosterFee`.
 *      - Poster: A 3rd party service dedicated to pose the off-chain transaction through GnosisSafe onto blockchain.
 *      - User: A wallet which is entitled to claim reward through `claimReward`, providing proofs.
 */
contract RewardDistributor is ReentrancyGuard {
    // rewardPoster maps a reward hash(merkle tree root) to the address that initiates the transaction pose the reward on chain.
    /// @dev Since root(reward hash) is unique, and we've guarded it in postReward,
    /// we don't need to worry about TX replay.
    /// @dev The leaf node encoding of the merkle tree is (recipient, amount, contract_address, kwil_block), maybe also
    /// add kwil_chainID to the encoding?  The unique character is also need by Kwil network, I believe.
    mapping(bytes32 => address) public rewardPoster;
    // isRewardClaimed maps a reward hash (merkle tree root) to the leaf hash of the Merkle tree to whether it has been claimed
    mapping(bytes32 => mapping(bytes32 => bool)) public isRewardClaimed;
    // posterFee is the fee that rewardClaimer will pay to the 'rewardPoster' on each claim
    uint256 public posterFee;
    // rewardToken is the address of the ERC20 token used for rewards
    IERC20 immutable public rewardToken;
    // postedRewards is the total amount of rewards posted to the contract.
    // It can never exceed the total balance of the token owned by the contract.
    uint256 public postedRewards;
    // safe is the GnosisSafe wallet address. Only this wallet can postReward/updatePosterFee.
    address public safe;
    // nonce is used to prevent off-chain tx replay, used by updatePosterFee.
    uint256 public nonce;

    event RewardPosted(bytes32 root, uint256 amount, address poster);
    event RewardClaimed(address recipient, uint256 amount, address claimer);
    event PosterFeeUpdated(uint256 newFee, uint256 nonce);

    /// @dev should be called by network owner
    constructor(address _safe, uint256 _posterFee, address _rewardToken) {
        require(_safe != address(0), "ZERO ADDRESS");
        require(_rewardToken != address(0), "ZERO ADDRESS");
        require(_posterFee > 0, "PostFee zero");

        posterFee = _posterFee;
        rewardToken = IERC20(_rewardToken);
        safe = _safe;
    }

    /// This function adds new reward record to the contract.
    /// It requires at least threshold signatures from allowed signers.
    /// @dev It's called by network rewardPoster.
    /// @dev Since rewardRoot is unique, it can also prevent tx replay.
    /// @dev We can also add a parameter 'nonce', but seems not necessary since rewardRoot is unique.
    function postReward(bytes32 rewardRoot, uint256 rewardAmount) external {
        require(msg.sender == safe, "Not allowed");
        require(rewardAmount > 0, "Total amount zero");
        require(rewardPoster[rewardRoot] == address(0), "Already posted");
        require(rewardToken.balanceOf(address(this)) >= postedRewards + rewardAmount, "Insufficient contract reward balance");

        rewardPoster[rewardRoot] = tx.origin; // whoever initiate this TX through gnosis-safe
        postedRewards += rewardAmount;

        emit RewardPosted(rewardRoot, rewardAmount, msg.sender);
    }

    /// This function updates the fee that rewardPoster will be paid.
    /// It must be signed by at least threshold signers.
    function updatePosterFee(uint256 newFee, uint256 _nonce) external {
        require(msg.sender == safe, "Not allowed");
        require(newFee > 0, "Fee zero");
        require(nonce == _nonce, "Nonce does not match");

        posterFee = newFee;
        nonce += 1;

        emit PosterFeeUpdated(newFee, nonce-1);
    }

    /// This allows a user to claim reward by providing the leaf data and
    /// correspond Merkle proof, on behalf of the recipient.
    /// The reward must be posted and not already claimed.
    /// @dev This is only way to transfer reward token out of this contract.
    /// @dev This is called by a rewardClaimer, not necessarily the recipient.
    ///      and there is no reimbursement for whoever is not the recipient call
    ///      this function, it's settled off-chain.
    /// @dev Since we need to transfer reward token to the recipient encoded in the Merkle tree,
    ///      we have to generate and verify the leaf in the contract to ensure the authenticity.
    function claimReward(
        address recipient,
        uint256 amount,
        uint256 kwilBlock,
        bytes32 rewardRoot,
        bytes32[] calldata proof
    )
        external
        payable
        nonReentrant
    {
        address payable poster = payable(rewardPoster[rewardRoot]);
        require(poster != address(0), "Reward root not posted");

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(recipient, amount, address(this), kwilBlock))));
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

    /// unpostedRewards is the total amount of rewards that are owned by the contract
    /// and have not been posted in a reward root.
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