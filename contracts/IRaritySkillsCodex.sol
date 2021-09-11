//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IRaritySkillsCodex {
    function skill_by_id(uint) external view returns (
        uint id,
        string memory name,
        uint attribute_id,
        uint synergy,
        bool retry,
        bool armor_check_penalty,
        string memory check,
        string memory action
    );
}