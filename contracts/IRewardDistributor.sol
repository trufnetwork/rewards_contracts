// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRewardDistributor {
    function setup(address _safe, uint256 _posterFee, address _rewardToken) external;
    function postReward(bytes32 root, uint256 amount) external;
    function updatePosterFee(uint256 newFee) external;
    function claimReward(address recipient, uint256 amount, bytes32 kwilBlockHash, bytes32 rewardRoot, bytes32[] calldata proofs) external payable;
}