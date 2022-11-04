// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

// upgradeable proxy imports
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./DataUnionTemplate.sol";
import "./Ownable.sol";

contract DataUnionFactory is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    event DUCreated(address indexed du, address indexed owner, address template);

    event NewDUInitialEthUpdated(uint amount);
    event NewDUOwnerInitialEthUpdated(uint amount);
    event DefaultNewMemberInitialEthUpdated(uint amount);
    event ProtocolFeeOracleUpdated(address newFeeOracleAddress);

    event DUInitialEthSent(uint amountWei);
    event OwnerInitialEthSent(uint amountWei);

    address public dataUnionTemplate;
    address public defaultToken;

    // when sidechain DU is created, the factory sends a bit of sETH to the DU and the owner
    uint public newDUInitialEth;
    uint public newDUOwnerInitialEth;
    uint public defaultNewMemberEth;
    address public protocolFeeOracle;

    /** Two phase hand-over to minimize the chance that the product ownership is lost to a non-existent address. */
    address public pendingOwner;

    function initialize(
        address _dataUnionTemplate,
        address _defaultToken,
        address _protocolFeeOracle
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        setTemplate(_dataUnionTemplate);
        defaultToken = _defaultToken;
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

    function setProtocolFeeOracle(address newFeeOracleAddress) public onlyOwner {
        protocolFeeOracle = newFeeOracleAddress;
        emit ProtocolFeeOracleUpdated(newFeeOracleAddress);
    }

    function deployNewDataUnion(
        address payable owner,
        uint256 adminFeeFraction,
        address[] memory agents,
        string calldata metadataJsonString
    )
        public
        returns (address)
    {
        return deployNewDataUnionUsingToken(
            defaultToken,
            owner,
            agents,
            adminFeeFraction,
            metadataJsonString
        );
    }

    function deployNewDataUnionUsingToken(
        address token,
        address payable owner,
        address[] memory agents,
        uint256 initialAdminFeeFraction,
        string calldata metadataJsonString
    ) public returns (address) {
        address payable du = payable(Clones.clone(dataUnionTemplate));
        DataUnionTemplate(du).initialize(
            owner,
            token,
            agents,
            defaultNewMemberEth,
            initialAdminFeeFraction,
            protocolFeeOracle,
            metadataJsonString
        );

        // TODO: move this emit to first thing in this function. We want this event first, THEN events fired by initialize, so that thegraph indexes correctly
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

    /**
     * @dev Override openzeppelin implementation
     * @dev Allows the current owner to set the pendingOwner address.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != address(0), "error_zeroAddress");
        pendingOwner = newOwner;
    }

    /**
     * @dev Allows the pendingOwner address to finalize the transfer.
     */
    function claimOwnership() public {
        require(msg.sender == pendingOwner, "error_onlyPendingOwner");
        _transferOwnership(pendingOwner);
        pendingOwner = address(0);
    }

    /**
     * @dev Disable openzeppelin renounce ownership functionality
     */
    function renounceOwnership() public override onlyOwner {}

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
