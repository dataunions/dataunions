// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../CloneLib.sol";
import "../xdai-mainnet-bridge/IAMB.sol";
import "../xdai-mainnet-bridge/ITokenMediator.sol";
// TODO: switch to "@openzeppelin/contracts/access/Ownable.sol";
import "../Ownable.sol";

contract DataUnionFactory is Ownable {
    event SidechainDUCreated(address indexed mainnet, address indexed sidenet, address indexed owner, address template);
    event UpdateNewDUInitialEth(uint amount);
    event UpdateNewDUOwnerInitialEth(uint amount);
    event UpdateDefaultNewMemberInitialEth(uint amount);
    event DUInitialEthSent(uint amountWei);
    event OwnerInitialEthSent(uint amountWei);

    address public dataUnionSidechainTemplate;
    address public defaultToken;
    address public defaultTokenMediator;

    // when sidechain DU is created, the factory sends a bit of sETH to the DU and the owner
    uint public newDUInitialEth;
    uint public newDUOwnerInitialEth;
    uint public defaultNewMemberEth;

    constructor(
        address _dataUnionSidechainTemplate,
        address _defaultToken,
        address _defaultTokenMediator
        ) Ownable(msg.sender) {
        setTemplate(_dataUnionSidechainTemplate);
        defaultToken = _defaultToken;
        defaultTokenMediator = _defaultTokenMediator;
    }

    function setTemplate(address _dataUnionSidechainTemplate) public onlyOwner {
        dataUnionSidechainTemplate = _dataUnionSidechainTemplate;
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

    function sidechainAddress(address mainnetAddress)
        public view
        returns (address proxy)
    {
        return mainnetAddress;
    }

    function amb(address _mediator) public view returns (IAMB) {
        return IAMB(ITokenMediator(_mediator).bridgeContract());
    }

    function deployNewDataUnion(
        address payable owner,
        uint256 adminFeeFraction,
        uint256 duFeeFraction,
        address duBeneficiary,
        address[] memory agents,
        string memory name
    )
        public
        returns (address)
    {
        return deployNewDataUnionUsingToken(
            defaultToken,
            defaultTokenMediator,
            owner,
            agents,
            adminFeeFraction,
            duFeeFraction,
            duBeneficiary,
            name
        );
    }
    /**
     * @dev This function is called over the bridge by the DataUnionMainnet.initialize function
     * @dev Hence must be called by the AMB. Use MockAMB for testing.
     * @dev CREATE2 salt = mainnet_address.
     */
    function deployNewDataUnionUsingToken(
        address token,
        address mediator,
        address payable owner,
        address[] memory agents,
        uint256 initialAdminFeeFraction,
        uint256 initialDataUnionFeeFraction,
        address initialDataUnionBeneficiary,
        string memory name
    ) public returns (address) {
        bytes32 salt = keccak256(abi.encode(bytes(name), msg.sender));
        bytes memory data = abi.encodeWithSignature(
            "initialize(address,address,address,address[],uint256,uint256,uint256,address)",
            owner,
            token,
            mediator,
            agents,
            defaultNewMemberEth,
            initialAdminFeeFraction,
            initialDataUnionFeeFraction,
            initialDataUnionBeneficiary
        );
        address payable du = CloneLib.deployCodeAndInitUsingCreate2(CloneLib.cloneBytecode(dataUnionSidechainTemplate), data, salt);
        emit SidechainDUCreated(du, du, owner, dataUnionSidechainTemplate);

        // continue whether or not send succeeds
        if (newDUInitialEth != 0 && address(this).balance >= newDUInitialEth) {
            if (du.send(newDUInitialEth)) {
                emit DUInitialEthSent(newDUInitialEth);
            }
        }
        if (newDUOwnerInitialEth != 0 && address(this).balance >= newDUOwnerInitialEth) {
            // solhint-disable-next-line multiple-sends
            if (owner.send(newDUOwnerInitialEth)) {
                emit OwnerInitialEthSent(newDUOwnerInitialEth);
            }
        }
        return du;
    }
}
