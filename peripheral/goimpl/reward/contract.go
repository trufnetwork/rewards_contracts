// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package reward

import (
	"errors"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = errors.New
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
	_ = abi.ConvertType
)

// RewardMetaData contains all meta data concerning the Reward contract.
var RewardMetaData = &bind.MetaData{
	ABI: "[{\"inputs\":[{\"internalType\":\"address\",\"name\":\"_safe\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"_posterFee\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"_rewardToken\",\"type\":\"address\"}],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"inputs\":[],\"name\":\"ReentrancyGuardReentrantCall\",\"type\":\"error\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"newFee\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"nonce\",\"type\":\"uint256\"}],\"name\":\"PosterFeeUpdated\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"internalType\":\"address\",\"name\":\"recipient\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"address\",\"name\":\"claimer\",\"type\":\"address\"}],\"name\":\"RewardClaimed\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"internalType\":\"bytes32\",\"name\":\"root\",\"type\":\"bytes32\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"address\",\"name\":\"poster\",\"type\":\"address\"}],\"name\":\"RewardPosted\",\"type\":\"event\"},{\"stateMutability\":\"payable\",\"type\":\"fallback\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"recipient\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"kwilBlock\",\"type\":\"uint256\"},{\"internalType\":\"bytes32\",\"name\":\"rewardRoot\",\"type\":\"bytes32\"},{\"internalType\":\"bytes32[]\",\"name\":\"proofs\",\"type\":\"bytes32[]\"}],\"name\":\"claimReward\",\"outputs\":[],\"stateMutability\":\"payable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"},{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"name\":\"isRewardClaimed\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"nonce\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"root\",\"type\":\"bytes32\"},{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"postReward\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"postedRewards\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"posterFee\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"name\":\"rewardPoster\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"rewardToken\",\"outputs\":[{\"internalType\":\"contractIERC20\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"safe\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"unpostedRewards\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"newFee\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_nonce\",\"type\":\"uint256\"}],\"name\":\"updatePosterFee\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"stateMutability\":\"payable\",\"type\":\"receive\"}]",
}

// RewardABI is the input ABI used to generate the binding from.
// Deprecated: Use RewardMetaData.ABI instead.
var RewardABI = RewardMetaData.ABI

// Reward is an auto generated Go binding around an Ethereum contract.
type Reward struct {
	RewardCaller     // Read-only binding to the contract
	RewardTransactor // Write-only binding to the contract
	RewardFilterer   // Log filterer for contract events
}

// RewardCaller is an auto generated read-only Go binding around an Ethereum contract.
type RewardCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// RewardTransactor is an auto generated write-only Go binding around an Ethereum contract.
type RewardTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// RewardFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type RewardFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// RewardSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type RewardSession struct {
	Contract     *Reward           // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// RewardCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type RewardCallerSession struct {
	Contract *RewardCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts // Call options to use throughout this session
}

// RewardTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type RewardTransactorSession struct {
	Contract     *RewardTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// RewardRaw is an auto generated low-level Go binding around an Ethereum contract.
type RewardRaw struct {
	Contract *Reward // Generic contract binding to access the raw methods on
}

// RewardCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type RewardCallerRaw struct {
	Contract *RewardCaller // Generic read-only contract binding to access the raw methods on
}

// RewardTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type RewardTransactorRaw struct {
	Contract *RewardTransactor // Generic write-only contract binding to access the raw methods on
}

// NewReward creates a new instance of Reward, bound to a specific deployed contract.
func NewReward(address common.Address, backend bind.ContractBackend) (*Reward, error) {
	contract, err := bindReward(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &Reward{RewardCaller: RewardCaller{contract: contract}, RewardTransactor: RewardTransactor{contract: contract}, RewardFilterer: RewardFilterer{contract: contract}}, nil
}

// NewRewardCaller creates a new read-only instance of Reward, bound to a specific deployed contract.
func NewRewardCaller(address common.Address, caller bind.ContractCaller) (*RewardCaller, error) {
	contract, err := bindReward(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &RewardCaller{contract: contract}, nil
}

// NewRewardTransactor creates a new write-only instance of Reward, bound to a specific deployed contract.
func NewRewardTransactor(address common.Address, transactor bind.ContractTransactor) (*RewardTransactor, error) {
	contract, err := bindReward(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &RewardTransactor{contract: contract}, nil
}

// NewRewardFilterer creates a new log filterer instance of Reward, bound to a specific deployed contract.
func NewRewardFilterer(address common.Address, filterer bind.ContractFilterer) (*RewardFilterer, error) {
	contract, err := bindReward(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &RewardFilterer{contract: contract}, nil
}

// bindReward binds a generic wrapper to an already deployed contract.
func bindReward(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := RewardMetaData.GetAbi()
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, *parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Reward *RewardRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Reward.Contract.RewardCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Reward *RewardRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Reward.Contract.RewardTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Reward *RewardRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Reward.Contract.RewardTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Reward *RewardCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Reward.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Reward *RewardTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Reward.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Reward *RewardTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Reward.Contract.contract.Transact(opts, method, params...)
}

// IsRewardClaimed is a free data retrieval call binding the contract method 0x27dda893.
//
// Solidity: function isRewardClaimed(bytes32 , bytes32 ) view returns(bool)
func (_Reward *RewardCaller) IsRewardClaimed(opts *bind.CallOpts, arg0 [32]byte, arg1 [32]byte) (bool, error) {
	var out []interface{}
	err := _Reward.contract.Call(opts, &out, "isRewardClaimed", arg0, arg1)

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// IsRewardClaimed is a free data retrieval call binding the contract method 0x27dda893.
//
// Solidity: function isRewardClaimed(bytes32 , bytes32 ) view returns(bool)
func (_Reward *RewardSession) IsRewardClaimed(arg0 [32]byte, arg1 [32]byte) (bool, error) {
	return _Reward.Contract.IsRewardClaimed(&_Reward.CallOpts, arg0, arg1)
}

// IsRewardClaimed is a free data retrieval call binding the contract method 0x27dda893.
//
// Solidity: function isRewardClaimed(bytes32 , bytes32 ) view returns(bool)
func (_Reward *RewardCallerSession) IsRewardClaimed(arg0 [32]byte, arg1 [32]byte) (bool, error) {
	return _Reward.Contract.IsRewardClaimed(&_Reward.CallOpts, arg0, arg1)
}

// Nonce is a free data retrieval call binding the contract method 0xaffed0e0.
//
// Solidity: function nonce() view returns(uint256)
func (_Reward *RewardCaller) Nonce(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _Reward.contract.Call(opts, &out, "nonce")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// Nonce is a free data retrieval call binding the contract method 0xaffed0e0.
//
// Solidity: function nonce() view returns(uint256)
func (_Reward *RewardSession) Nonce() (*big.Int, error) {
	return _Reward.Contract.Nonce(&_Reward.CallOpts)
}

// Nonce is a free data retrieval call binding the contract method 0xaffed0e0.
//
// Solidity: function nonce() view returns(uint256)
func (_Reward *RewardCallerSession) Nonce() (*big.Int, error) {
	return _Reward.Contract.Nonce(&_Reward.CallOpts)
}

// PostedRewards is a free data retrieval call binding the contract method 0x122d52de.
//
// Solidity: function postedRewards() view returns(uint256)
func (_Reward *RewardCaller) PostedRewards(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _Reward.contract.Call(opts, &out, "postedRewards")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// PostedRewards is a free data retrieval call binding the contract method 0x122d52de.
//
// Solidity: function postedRewards() view returns(uint256)
func (_Reward *RewardSession) PostedRewards() (*big.Int, error) {
	return _Reward.Contract.PostedRewards(&_Reward.CallOpts)
}

// PostedRewards is a free data retrieval call binding the contract method 0x122d52de.
//
// Solidity: function postedRewards() view returns(uint256)
func (_Reward *RewardCallerSession) PostedRewards() (*big.Int, error) {
	return _Reward.Contract.PostedRewards(&_Reward.CallOpts)
}

// PosterFee is a free data retrieval call binding the contract method 0x408422bc.
//
// Solidity: function posterFee() view returns(uint256)
func (_Reward *RewardCaller) PosterFee(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _Reward.contract.Call(opts, &out, "posterFee")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// PosterFee is a free data retrieval call binding the contract method 0x408422bc.
//
// Solidity: function posterFee() view returns(uint256)
func (_Reward *RewardSession) PosterFee() (*big.Int, error) {
	return _Reward.Contract.PosterFee(&_Reward.CallOpts)
}

// PosterFee is a free data retrieval call binding the contract method 0x408422bc.
//
// Solidity: function posterFee() view returns(uint256)
func (_Reward *RewardCallerSession) PosterFee() (*big.Int, error) {
	return _Reward.Contract.PosterFee(&_Reward.CallOpts)
}

// RewardPoster is a free data retrieval call binding the contract method 0x75cbd82d.
//
// Solidity: function rewardPoster(bytes32 ) view returns(address)
func (_Reward *RewardCaller) RewardPoster(opts *bind.CallOpts, arg0 [32]byte) (common.Address, error) {
	var out []interface{}
	err := _Reward.contract.Call(opts, &out, "rewardPoster", arg0)

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// RewardPoster is a free data retrieval call binding the contract method 0x75cbd82d.
//
// Solidity: function rewardPoster(bytes32 ) view returns(address)
func (_Reward *RewardSession) RewardPoster(arg0 [32]byte) (common.Address, error) {
	return _Reward.Contract.RewardPoster(&_Reward.CallOpts, arg0)
}

// RewardPoster is a free data retrieval call binding the contract method 0x75cbd82d.
//
// Solidity: function rewardPoster(bytes32 ) view returns(address)
func (_Reward *RewardCallerSession) RewardPoster(arg0 [32]byte) (common.Address, error) {
	return _Reward.Contract.RewardPoster(&_Reward.CallOpts, arg0)
}

// RewardToken is a free data retrieval call binding the contract method 0xf7c618c1.
//
// Solidity: function rewardToken() view returns(address)
func (_Reward *RewardCaller) RewardToken(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _Reward.contract.Call(opts, &out, "rewardToken")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// RewardToken is a free data retrieval call binding the contract method 0xf7c618c1.
//
// Solidity: function rewardToken() view returns(address)
func (_Reward *RewardSession) RewardToken() (common.Address, error) {
	return _Reward.Contract.RewardToken(&_Reward.CallOpts)
}

// RewardToken is a free data retrieval call binding the contract method 0xf7c618c1.
//
// Solidity: function rewardToken() view returns(address)
func (_Reward *RewardCallerSession) RewardToken() (common.Address, error) {
	return _Reward.Contract.RewardToken(&_Reward.CallOpts)
}

// Safe is a free data retrieval call binding the contract method 0x186f0354.
//
// Solidity: function safe() view returns(address)
func (_Reward *RewardCaller) Safe(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _Reward.contract.Call(opts, &out, "safe")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Safe is a free data retrieval call binding the contract method 0x186f0354.
//
// Solidity: function safe() view returns(address)
func (_Reward *RewardSession) Safe() (common.Address, error) {
	return _Reward.Contract.Safe(&_Reward.CallOpts)
}

// Safe is a free data retrieval call binding the contract method 0x186f0354.
//
// Solidity: function safe() view returns(address)
func (_Reward *RewardCallerSession) Safe() (common.Address, error) {
	return _Reward.Contract.Safe(&_Reward.CallOpts)
}

// UnpostedRewards is a free data retrieval call binding the contract method 0xd5cf76f5.
//
// Solidity: function unpostedRewards() view returns(uint256)
func (_Reward *RewardCaller) UnpostedRewards(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _Reward.contract.Call(opts, &out, "unpostedRewards")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// UnpostedRewards is a free data retrieval call binding the contract method 0xd5cf76f5.
//
// Solidity: function unpostedRewards() view returns(uint256)
func (_Reward *RewardSession) UnpostedRewards() (*big.Int, error) {
	return _Reward.Contract.UnpostedRewards(&_Reward.CallOpts)
}

// UnpostedRewards is a free data retrieval call binding the contract method 0xd5cf76f5.
//
// Solidity: function unpostedRewards() view returns(uint256)
func (_Reward *RewardCallerSession) UnpostedRewards() (*big.Int, error) {
	return _Reward.Contract.UnpostedRewards(&_Reward.CallOpts)
}

// ClaimReward is a paid mutator transaction binding the contract method 0x324e1429.
//
// Solidity: function claimReward(address recipient, uint256 amount, uint256 kwilBlock, bytes32 rewardRoot, bytes32[] proofs) payable returns()
func (_Reward *RewardTransactor) ClaimReward(opts *bind.TransactOpts, recipient common.Address, amount *big.Int, kwilBlock *big.Int, rewardRoot [32]byte, proofs [][32]byte) (*types.Transaction, error) {
	return _Reward.contract.Transact(opts, "claimReward", recipient, amount, kwilBlock, rewardRoot, proofs)
}

// ClaimReward is a paid mutator transaction binding the contract method 0x324e1429.
//
// Solidity: function claimReward(address recipient, uint256 amount, uint256 kwilBlock, bytes32 rewardRoot, bytes32[] proofs) payable returns()
func (_Reward *RewardSession) ClaimReward(recipient common.Address, amount *big.Int, kwilBlock *big.Int, rewardRoot [32]byte, proofs [][32]byte) (*types.Transaction, error) {
	return _Reward.Contract.ClaimReward(&_Reward.TransactOpts, recipient, amount, kwilBlock, rewardRoot, proofs)
}

// ClaimReward is a paid mutator transaction binding the contract method 0x324e1429.
//
// Solidity: function claimReward(address recipient, uint256 amount, uint256 kwilBlock, bytes32 rewardRoot, bytes32[] proofs) payable returns()
func (_Reward *RewardTransactorSession) ClaimReward(recipient common.Address, amount *big.Int, kwilBlock *big.Int, rewardRoot [32]byte, proofs [][32]byte) (*types.Transaction, error) {
	return _Reward.Contract.ClaimReward(&_Reward.TransactOpts, recipient, amount, kwilBlock, rewardRoot, proofs)
}

// PostReward is a paid mutator transaction binding the contract method 0xeb630dd3.
//
// Solidity: function postReward(bytes32 root, uint256 amount) returns()
func (_Reward *RewardTransactor) PostReward(opts *bind.TransactOpts, root [32]byte, amount *big.Int) (*types.Transaction, error) {
	return _Reward.contract.Transact(opts, "postReward", root, amount)
}

// PostReward is a paid mutator transaction binding the contract method 0xeb630dd3.
//
// Solidity: function postReward(bytes32 root, uint256 amount) returns()
func (_Reward *RewardSession) PostReward(root [32]byte, amount *big.Int) (*types.Transaction, error) {
	return _Reward.Contract.PostReward(&_Reward.TransactOpts, root, amount)
}

// PostReward is a paid mutator transaction binding the contract method 0xeb630dd3.
//
// Solidity: function postReward(bytes32 root, uint256 amount) returns()
func (_Reward *RewardTransactorSession) PostReward(root [32]byte, amount *big.Int) (*types.Transaction, error) {
	return _Reward.Contract.PostReward(&_Reward.TransactOpts, root, amount)
}

// UpdatePosterFee is a paid mutator transaction binding the contract method 0xe08b22fa.
//
// Solidity: function updatePosterFee(uint256 newFee, uint256 _nonce) returns()
func (_Reward *RewardTransactor) UpdatePosterFee(opts *bind.TransactOpts, newFee *big.Int, _nonce *big.Int) (*types.Transaction, error) {
	return _Reward.contract.Transact(opts, "updatePosterFee", newFee, _nonce)
}

// UpdatePosterFee is a paid mutator transaction binding the contract method 0xe08b22fa.
//
// Solidity: function updatePosterFee(uint256 newFee, uint256 _nonce) returns()
func (_Reward *RewardSession) UpdatePosterFee(newFee *big.Int, _nonce *big.Int) (*types.Transaction, error) {
	return _Reward.Contract.UpdatePosterFee(&_Reward.TransactOpts, newFee, _nonce)
}

// UpdatePosterFee is a paid mutator transaction binding the contract method 0xe08b22fa.
//
// Solidity: function updatePosterFee(uint256 newFee, uint256 _nonce) returns()
func (_Reward *RewardTransactorSession) UpdatePosterFee(newFee *big.Int, _nonce *big.Int) (*types.Transaction, error) {
	return _Reward.Contract.UpdatePosterFee(&_Reward.TransactOpts, newFee, _nonce)
}

// Fallback is a paid mutator transaction binding the contract fallback function.
//
// Solidity: fallback() payable returns()
func (_Reward *RewardTransactor) Fallback(opts *bind.TransactOpts, calldata []byte) (*types.Transaction, error) {
	return _Reward.contract.RawTransact(opts, calldata)
}

// Fallback is a paid mutator transaction binding the contract fallback function.
//
// Solidity: fallback() payable returns()
func (_Reward *RewardSession) Fallback(calldata []byte) (*types.Transaction, error) {
	return _Reward.Contract.Fallback(&_Reward.TransactOpts, calldata)
}

// Fallback is a paid mutator transaction binding the contract fallback function.
//
// Solidity: fallback() payable returns()
func (_Reward *RewardTransactorSession) Fallback(calldata []byte) (*types.Transaction, error) {
	return _Reward.Contract.Fallback(&_Reward.TransactOpts, calldata)
}

// Receive is a paid mutator transaction binding the contract receive function.
//
// Solidity: receive() payable returns()
func (_Reward *RewardTransactor) Receive(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Reward.contract.RawTransact(opts, nil) // calldata is disallowed for receive function
}

// Receive is a paid mutator transaction binding the contract receive function.
//
// Solidity: receive() payable returns()
func (_Reward *RewardSession) Receive() (*types.Transaction, error) {
	return _Reward.Contract.Receive(&_Reward.TransactOpts)
}

// Receive is a paid mutator transaction binding the contract receive function.
//
// Solidity: receive() payable returns()
func (_Reward *RewardTransactorSession) Receive() (*types.Transaction, error) {
	return _Reward.Contract.Receive(&_Reward.TransactOpts)
}

// RewardPosterFeeUpdatedIterator is returned from FilterPosterFeeUpdated and is used to iterate over the raw logs and unpacked data for PosterFeeUpdated events raised by the Reward contract.
type RewardPosterFeeUpdatedIterator struct {
	Event *RewardPosterFeeUpdated // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *RewardPosterFeeUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(RewardPosterFeeUpdated)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(RewardPosterFeeUpdated)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *RewardPosterFeeUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *RewardPosterFeeUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// RewardPosterFeeUpdated represents a PosterFeeUpdated event raised by the Reward contract.
type RewardPosterFeeUpdated struct {
	NewFee *big.Int
	Nonce  *big.Int
	Raw    types.Log // Blockchain specific contextual infos
}

// FilterPosterFeeUpdated is a free log retrieval operation binding the contract event 0x7c7423dff6eff60ac491456a649034ee92866801bb236290a4b9190e370e8952.
//
// Solidity: event PosterFeeUpdated(uint256 newFee, uint256 nonce)
func (_Reward *RewardFilterer) FilterPosterFeeUpdated(opts *bind.FilterOpts) (*RewardPosterFeeUpdatedIterator, error) {

	logs, sub, err := _Reward.contract.FilterLogs(opts, "PosterFeeUpdated")
	if err != nil {
		return nil, err
	}
	return &RewardPosterFeeUpdatedIterator{contract: _Reward.contract, event: "PosterFeeUpdated", logs: logs, sub: sub}, nil
}

// WatchPosterFeeUpdated is a free log subscription operation binding the contract event 0x7c7423dff6eff60ac491456a649034ee92866801bb236290a4b9190e370e8952.
//
// Solidity: event PosterFeeUpdated(uint256 newFee, uint256 nonce)
func (_Reward *RewardFilterer) WatchPosterFeeUpdated(opts *bind.WatchOpts, sink chan<- *RewardPosterFeeUpdated) (event.Subscription, error) {

	logs, sub, err := _Reward.contract.WatchLogs(opts, "PosterFeeUpdated")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(RewardPosterFeeUpdated)
				if err := _Reward.contract.UnpackLog(event, "PosterFeeUpdated", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParsePosterFeeUpdated is a log parse operation binding the contract event 0x7c7423dff6eff60ac491456a649034ee92866801bb236290a4b9190e370e8952.
//
// Solidity: event PosterFeeUpdated(uint256 newFee, uint256 nonce)
func (_Reward *RewardFilterer) ParsePosterFeeUpdated(log types.Log) (*RewardPosterFeeUpdated, error) {
	event := new(RewardPosterFeeUpdated)
	if err := _Reward.contract.UnpackLog(event, "PosterFeeUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// RewardRewardClaimedIterator is returned from FilterRewardClaimed and is used to iterate over the raw logs and unpacked data for RewardClaimed events raised by the Reward contract.
type RewardRewardClaimedIterator struct {
	Event *RewardRewardClaimed // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *RewardRewardClaimedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(RewardRewardClaimed)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(RewardRewardClaimed)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *RewardRewardClaimedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *RewardRewardClaimedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// RewardRewardClaimed represents a RewardClaimed event raised by the Reward contract.
type RewardRewardClaimed struct {
	Recipient common.Address
	Amount    *big.Int
	Claimer   common.Address
	Raw       types.Log // Blockchain specific contextual infos
}

// FilterRewardClaimed is a free log retrieval operation binding the contract event 0xf80b6d248ca65e589d3f24c7ce36e2df22ba16ba4e7656aad67e114abbe971d2.
//
// Solidity: event RewardClaimed(address recipient, uint256 amount, address claimer)
func (_Reward *RewardFilterer) FilterRewardClaimed(opts *bind.FilterOpts) (*RewardRewardClaimedIterator, error) {

	logs, sub, err := _Reward.contract.FilterLogs(opts, "RewardClaimed")
	if err != nil {
		return nil, err
	}
	return &RewardRewardClaimedIterator{contract: _Reward.contract, event: "RewardClaimed", logs: logs, sub: sub}, nil
}

// WatchRewardClaimed is a free log subscription operation binding the contract event 0xf80b6d248ca65e589d3f24c7ce36e2df22ba16ba4e7656aad67e114abbe971d2.
//
// Solidity: event RewardClaimed(address recipient, uint256 amount, address claimer)
func (_Reward *RewardFilterer) WatchRewardClaimed(opts *bind.WatchOpts, sink chan<- *RewardRewardClaimed) (event.Subscription, error) {

	logs, sub, err := _Reward.contract.WatchLogs(opts, "RewardClaimed")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(RewardRewardClaimed)
				if err := _Reward.contract.UnpackLog(event, "RewardClaimed", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseRewardClaimed is a log parse operation binding the contract event 0xf80b6d248ca65e589d3f24c7ce36e2df22ba16ba4e7656aad67e114abbe971d2.
//
// Solidity: event RewardClaimed(address recipient, uint256 amount, address claimer)
func (_Reward *RewardFilterer) ParseRewardClaimed(log types.Log) (*RewardRewardClaimed, error) {
	event := new(RewardRewardClaimed)
	if err := _Reward.contract.UnpackLog(event, "RewardClaimed", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// RewardRewardPostedIterator is returned from FilterRewardPosted and is used to iterate over the raw logs and unpacked data for RewardPosted events raised by the Reward contract.
type RewardRewardPostedIterator struct {
	Event *RewardRewardPosted // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *RewardRewardPostedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(RewardRewardPosted)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(RewardRewardPosted)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *RewardRewardPostedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *RewardRewardPostedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// RewardRewardPosted represents a RewardPosted event raised by the Reward contract.
type RewardRewardPosted struct {
	Root   [32]byte
	Amount *big.Int
	Poster common.Address
	Raw    types.Log // Blockchain specific contextual infos
}

// FilterRewardPosted is a free log retrieval operation binding the contract event 0x88d468d3eafea83d2406f714eb4c2737e374f70e2f01fe43ec07e118e28d7525.
//
// Solidity: event RewardPosted(bytes32 root, uint256 amount, address poster)
func (_Reward *RewardFilterer) FilterRewardPosted(opts *bind.FilterOpts) (*RewardRewardPostedIterator, error) {

	logs, sub, err := _Reward.contract.FilterLogs(opts, "RewardPosted")
	if err != nil {
		return nil, err
	}
	return &RewardRewardPostedIterator{contract: _Reward.contract, event: "RewardPosted", logs: logs, sub: sub}, nil
}

// WatchRewardPosted is a free log subscription operation binding the contract event 0x88d468d3eafea83d2406f714eb4c2737e374f70e2f01fe43ec07e118e28d7525.
//
// Solidity: event RewardPosted(bytes32 root, uint256 amount, address poster)
func (_Reward *RewardFilterer) WatchRewardPosted(opts *bind.WatchOpts, sink chan<- *RewardRewardPosted) (event.Subscription, error) {

	logs, sub, err := _Reward.contract.WatchLogs(opts, "RewardPosted")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(RewardRewardPosted)
				if err := _Reward.contract.UnpackLog(event, "RewardPosted", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseRewardPosted is a log parse operation binding the contract event 0x88d468d3eafea83d2406f714eb4c2737e374f70e2f01fe43ec07e118e28d7525.
//
// Solidity: event RewardPosted(bytes32 root, uint256 amount, address poster)
func (_Reward *RewardFilterer) ParseRewardPosted(log types.Log) (*RewardRewardPosted, error) {
	event := new(RewardRewardPosted)
	if err := _Reward.contract.UnpackLog(event, "RewardPosted", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}
