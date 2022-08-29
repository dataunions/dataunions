// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "../xdai-mainnet-bridge/IAMB.sol";
import "./DataUnionTemplate.sol";
import "../Ownable.sol";

contract DataUnionFactory is Ownable {
    event SidechainDUCreated(address indexed mainnet, address indexed sidenet, address indexed owner, address template);
    event DUCreated(address indexed du, address indexed owner, address template);

    event NewDUInitialEthUpdated(uint amount);
    event NewDUOwnerInitialEthUpdated(uint amount);
    event DefaultNewMemberInitialEthUpdated(uint amount);
    event ProtocolBeneficiaryUpdated(address newBeneficiaryAddress);
    event ProtocolFeeOracleUpdated(address newFeeOracleAddress);

    event DUInitialEthSent(uint amountWei);
    event OwnerInitialEthSent(uint amountWei);

    address public dataUnionTemplate;
    address public defaultToken;

    // when sidechain DU is created, the factory sends a bit of sETH to the DU and the owner
    uint public newDUInitialEth;
    uint public newDUOwnerInitialEth;
    uint public defaultNewMemberEth;
    address public protocolBeneficiary;
    address public protocolFeeOracle;

    constructor(
        address _dataUnionTemplate,
        address _defaultToken,
        address _protocolBeneficiary,
        address _protocolFeeOracle
    ) Ownable(msg.sender) {
        setTemplate(_dataUnionTemplate);
        defaultToken = _defaultToken;
        protocolBeneficiary = _protocolBeneficiary;
        protocolFeeOracle = _protocolFeeOracle;
    }

    function setTemplate(address _dataUnionTemplate) public onlyOwner {
        dataUnionTemplate = _dataUnionTemplate;
    }

    // contract is payable so it can receive and hold the new member eth stipends
    receive() external payable {}

    function setNewDUInitialEth(uint initialEthWei) public onlyOwner {
        newDUInitialEth = initialEthWei;
        emit NewDUInitialEthUpdated(initialEthWei);
    }

    function setNewDUOwnerInitialEth(uint initialEthWei) public onlyOwner {
        newDUOwnerInitialEth = initialEthWei;
        emit NewDUOwnerInitialEthUpdated(initialEthWei);
    }

    function setNewMemberInitialEth(uint initialEthWei) public onlyOwner {
        defaultNewMemberEth = initialEthWei;
        emit DefaultNewMemberInitialEthUpdated(initialEthWei);
    }

    function setProtocolBeneficiary(address newBeneficiaryAddress) public onlyOwner {
        protocolBeneficiary = newBeneficiaryAddress;
        emit ProtocolBeneficiaryUpdated(newBeneficiaryAddress);
    }

    function setProtocolFeeOracle(address newFeeOracleAddress) public onlyOwner {
        protocolFeeOracle = newFeeOracleAddress;
        emit ProtocolFeeOracleUpdated(newFeeOracleAddress);
    }

    function deployNewDataUnion(
        address payable owner,
        uint256 adminFeeFraction,
        address[] memory agents
    )
        public
        returns (address)
    {
        return deployNewDataUnionUsingToken(
            defaultToken,
            owner,
            agents,
            adminFeeFraction
        );
    }

    /**
     * @dev CREATE2 salt = mainnet_address.
     */
    function deployNewDataUnionUsingToken(
        address token,
        address payable owner,
        address[] memory agents,
        uint256 initialAdminFeeFraction
    ) public returns (address) {
        address payable du = payable(Clones.clone(dataUnionTemplate));
        DataUnionTemplate(du).initialize(
            owner,
            token,
            agents,
            defaultNewMemberEth,
            initialAdminFeeFraction,
            protocolBeneficiary,
            protocolFeeOracle
        );

        emit SidechainDUCreated(du, du, owner, dataUnionTemplate);
        emit DUCreated(du, owner, dataUnionTemplate);

        // continue whether or not send succeeds
        if (newDUInitialEth != 0 && address(this).balance >= newDUInitialEth) {
            if (du.send(newDUInitialEth)) {
                emit DUInitialEthSent(newDUInitialEth);
            }
        }
        if (newDUOwnerInitialEth != 0 && address(this).balance >= newDUOwnerInitialEth) {
            // ignore failed sends. If they don't want the stipend, that's not a problem
            // solhint-disable-next-line multiple-sends
            if (owner.send(newDUOwnerInitialEth)) {
                emit OwnerInitialEthSent(newDUOwnerInitialEth);
            }
        }
        return du;
    }
}
