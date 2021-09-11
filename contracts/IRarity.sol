//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./IERC721.sol";

interface IRarity is IERC721 {
    function summon(uint _class) external;
    function level(uint) external view returns (uint);
}