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
    event UpdateNewDUInitialEth(uint amount);
    event UpdateNewDUOwnerInitialEth(uint amount);
    event UpdateDefaultNewMemberInitialEth(uint amount);
    event DUInitialEthSent(uint amountWei);
    event OwnerInitialEthSent(uint amountWei);

    address public dataUnionTemplate;
    address public defaultToken;

    // when sidechain DU is created, the factory sends a bit of sETH to the DU and the owner
    uint public newDUInitialEth;
    uint public newDUOwnerInitialEth;
    uint public defaultNewMemberEth;

    constructor(
        address _dataUnionTemplate,
        address _defaultToken
    ) Ownable(msg.sender) {
        setTemplate(_dataUnionTemplate);
        defaultToken = _defaultToken;
    }

    function setTemplate(address _dataUnionTemplate) public onlyOwner {
        dataUnionTemplate = _dataUnionTemplate;
    }

    // contract is payable so it can receive and hold the new member eth stipends
    receive() external payable {}

    function setNewDUInitialEth(uint val) public onlyOwner {
        newDUInitialEth = val;
        emit UpdateNewDUInitialEth(val);
    }

    function setNewDUOwnerInitialEth(uint val) public onlyOwner {
        newDUOwnerInitialEth = val;
        emit UpdateNewDUOwnerInitialEth(val);
    }

    function setNewMemberInitialEth(uint val) public onlyOwner {
        defaultNewMemberEth = val;
        emit UpdateDefaultNewMemberInitialEth(val);
    }

    function deployNewDataUnion(
        address payable owner,
        uint256 adminFeeFraction,
        uint256 duFeeFraction,
        address duBeneficiary,
        address[] memory agents
    )
        public
        returns (address)
    {
        return deployNewDataUnionUsingToken(
            defaultToken,
            owner,
            agents,
            adminFeeFraction,
            duFeeFraction,
            duBeneficiary
        );
    }

    /**
     * @dev CREATE2 salt = mainnet_address.
     */
    function deployNewDataUnionUsingToken(
        address token,
        address payable owner,
        address[] memory agents,
        uint256 initialAdminFeeFraction,
        uint256 initialDataUnionFeeFraction,
        address initialDataUnionBeneficiary
    ) public returns (address) {
        address payable du = payable(Clones.clone(dataUnionTemplate));
        DataUnionTemplate(du).initialize(
            owner,
            token,
            agents,
            defaultNewMemberEth,
            initialAdminFeeFraction,
            initialDataUnionFeeFraction,
            initialDataUnionBeneficiary
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
