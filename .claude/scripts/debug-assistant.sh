#!/bin/bash
#
# Advanced Debugging Assistant
#
# Intelligent error analysis, stack trace decoding, and troubleshooting
# assistance for blockchain development.
#
# Features:
# - Solidity error code decoding
# - Revert reason extraction
# - Stack trace analysis
# - Common error pattern matching
# - Fix recommendations
# - Integration with block explorers
#

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Error code database
declare -A SOLIDITY_ERRORS=(
  ["0x08c379a0"]="Error(string) - Revert with message"
  ["0x4e487b71"]="Panic(uint256) - Compiler panic"
  ["0x1"]="Assertion failed"
  ["0x11"]="Arithmetic overflow/underflow"
  ["0x12"]="Division by zero"
  ["0x21"]="Invalid enum value"
  ["0x22"]="Invalid storage array access"
  ["0x31"]="Pop on empty array"
  ["0x32"]="Array out of bounds access"
  ["0x41"]="Out of memory"
  ["0x51"]="Invalid internal function call"
)

# Common error patterns
declare -A ERROR_PATTERNS=(
  ["out of gas"]="Transaction ran out of gas - increase gas limit or optimize code"
  ["revert"]="Transaction reverted - check require/revert conditions"
  ["invalid opcode"]="Invalid opcode - possible contract logic error or selfdestruct"
  ["stack too deep"]="Too many local variables - refactor into smaller functions"
  ["exceeds block gas limit"]="Transaction too complex - split into multiple transactions"
  ["nonce too low"]="Nonce mismatch - check nonce-manager or wait for pending tx"
  ["replacement transaction underpriced"]="Gas price too low for replacement - increase by at least 10%"
  ["insufficient funds"]="Account balance too low - fund the account"
  ["execution reverted"]="Generic revert - decode error data for details"
)

#
# Function: Decode error data
#
decode_error_data() {
  local error_data="$1"

  echo -e "${BLUE}═══ Error Data Decoding ═══${NC}"
  echo ""

  # Extract selector (first 10 characters including 0x)
  local selector="${error_data:0:10}"

  echo -e "Selector: ${CYAN}$selector${NC}"

  if [ -n "${SOLIDITY_ERRORS[$selector]}" ]; then
    echo -e "Type: ${GREEN}${SOLIDITY_ERRORS[$selector]}${NC}"
  fi

  echo ""

  # Decode Error(string) - 0x08c379a0
  if [ "$selector" == "0x08c379a0" ]; then
    echo "Decoding revert message..."

    # Use cast to decode if available
    if command -v cast &> /dev/null; then
      local message=$(cast --calldata-decode "Error(string)" "$error_data" 2>/dev/null || echo "Failed to decode")
      echo -e "Message: ${YELLOW}$message${NC}"
    else
      echo -e "${YELLOW}Install foundry's 'cast' for automatic decoding${NC}"
    fi

  # Decode Panic(uint256) - 0x4e487b71
  elif [ "$selector" == "0x4e487b71" ]; then
    echo "Decoding panic code..."

    # Extract panic code (next 32 bytes)
    local panic_code="${error_data:10:64}"
    # Convert hex to decimal
    local panic_decimal=$((16#${panic_code#0x}))

    echo -e "Panic Code: ${YELLOW}0x${panic_code}${NC} (${panic_decimal})"

    case "$panic_decimal" in
      1)
        echo -e "Reason: ${RED}Assertion failed${NC}"
        echo "Fix: Review assert() statements"
        ;;
      17)
        echo -e "Reason: ${RED}Arithmetic overflow/underflow${NC}"
        echo "Fix: Use SafeMath or Solidity 0.8+ with built-in checks"
        ;;
      18)
        echo -e "Reason: ${RED}Division by zero${NC}"
        echo "Fix: Add zero-check before division"
        ;;
      33)
        echo -e "Reason: ${RED}Invalid enum value${NC}"
        echo "Fix: Validate enum casts"
        ;;
      34)
        echo -e "Reason: ${RED}Invalid storage array encoding${NC}"
        echo "Fix: Check storage layout"
        ;;
      49)
        echo -e "Reason: ${RED}Pop on empty array${NC}"
        echo "Fix: Check array.length > 0 before pop"
        ;;
      50)
        echo -e "Reason: ${RED}Array out of bounds${NC}"
        echo "Fix: Check array index < array.length"
        ;;
      65)
        echo -e "Reason: ${RED}Out of memory${NC}"
        echo "Fix: Reduce memory allocations"
        ;;
      81)
        echo -e "Reason: ${RED}Invalid internal function call${NC}"
        echo "Fix: Check function pointers"
        ;;
      *)
        echo -e "Reason: ${YELLOW}Unknown panic code${NC}"
        ;;
    esac
  fi

  echo ""
}

#
# Function: Analyze transaction error
#
analyze_transaction() {
  local tx_hash="$1"
  local network="${2:-ethereum}"

  echo -e "${BLUE}═══ Transaction Analysis ═══${NC}"
  echo ""
  echo -e "Transaction: ${CYAN}$tx_hash${NC}"
  echo -e "Network: ${CYAN}$network${NC}"
  echo ""

  # Try to get transaction receipt using cast
  if command -v cast &> /dev/null; then
    local rpc_var=$(echo "${network}_RPC_URL" | tr '[:lower:]' '[:upper:]')
    local rpc_url="${!rpc_var}"

    if [ -z "$rpc_url" ]; then
      echo -e "${YELLOW}RPC URL not configured for $network${NC}"
      echo "Set with: export ${rpc_var}=<url>"
      return 1
    fi

    echo "Fetching transaction details..."

    # Get transaction receipt
    local receipt=$(cast receipt "$tx_hash" --rpc-url "$rpc_url" 2>&1)

    if echo "$receipt" | grep -q "status.*0x0"; then
      echo -e "Status: ${RED}FAILED${NC}"

      # Try to get revert reason
      echo ""
      echo "Attempting to extract revert reason..."

      local tx=$(cast tx "$tx_hash" --rpc-url "$rpc_url" 2>/dev/null)

      # Get the from, to, data from tx
      local from=$(echo "$tx" | grep "from:" | awk '{print $2}')
      local to=$(echo "$tx" | grep "^to:" | awk '{print $2}')
      local data=$(echo "$tx" | grep "input:" | awk '{print $2}')
      local value=$(echo "$tx" | grep "^value:" | awk '{print $2}')

      # Try to simulate the transaction
      local error_data=$(cast call "$to" "$data" --from "$from" --value "$value" --rpc-url "$rpc_url" 2>&1 || echo "")

      if [ -n "$error_data" ]; then
        decode_error_data "$error_data"
      fi

    elif echo "$receipt" | grep -q "status.*0x1"; then
      echo -e "Status: ${GREEN}SUCCESS${NC}"
    else
      echo -e "${YELLOW}Could not determine transaction status${NC}"
    fi

    # Show gas usage
    local gas_used=$(echo "$receipt" | grep "gasUsed" | awk '{print $2}')
    if [ -n "$gas_used" ]; then
      echo -e "Gas Used: ${CYAN}$gas_used${NC}"
    fi

  else
    echo -e "${YELLOW}Install foundry's 'cast' for transaction analysis${NC}"
    echo "Install: curl -L https://foundry.paradigm.xyz | bash"
  fi

  echo ""
}

#
# Function: Analyze forge test error
#
analyze_forge_error() {
  local error_output="$1"

  echo -e "${BLUE}═══ Forge Test Error Analysis ═══${NC}"
  echo ""

  # Check for common patterns
  if echo "$error_output" | grep -q "Stack too deep"; then
    echo -e "${RED}Error Type: Stack Too Deep${NC}"
    echo ""
    echo "Cause:"
    echo "  Too many local variables in a function"
    echo ""
    echo "Solutions:"
    echo "  1. Split function into smaller helper functions"
    echo "  2. Use structs to group related variables"
    echo "  3. Enable viaIR compiler optimization"
    echo "     Add to foundry.toml: via_ir = true"
    echo ""

  elif echo "$error_output" | grep -qi "revert"; then
    echo -e "${RED}Error Type: Revert${NC}"
    echo ""

    # Try to extract revert message
    local revert_msg=$(echo "$error_output" | grep -o "revert:.*" | head -1)

    if [ -n "$revert_msg" ]; then
      echo -e "Message: ${YELLOW}$revert_msg${NC}"
    fi

    echo ""
    echo "Common Causes:"
    echo "  • require() condition failed"
    echo "  • revert() called explicitly"
    echo "  • Custom error thrown"
    echo "  • Access control violation"
    echo ""
    echo "Debugging:"
    echo "  1. Add console.log() statements before revert"
    echo "  2. Check function preconditions"
    echo "  3. Verify msg.sender has required permissions"
    echo "  4. Use forge test -vvvv for detailed trace"
    echo ""

  elif echo "$error_output" | grep -qi "out of gas"; then
    echo -e "${RED}Error Type: Out of Gas${NC}"
    echo ""
    echo "Cause:"
    echo "  Transaction consumed all allocated gas"
    echo ""
    echo "Solutions:"
    echo "  1. Optimize contract logic (reduce loops, storage access)"
    echo "  2. Increase gas limit in test"
    echo "  3. Profile gas usage: forge test --gas-report"
    echo "  4. Check for infinite loops"
    echo ""

  elif echo "$error_output" | grep -qi "arithmetic.*overflow\|underflow"; then
    echo -e "${RED}Error Type: Arithmetic Overflow/Underflow${NC}"
    echo ""
    echo "Cause:"
    echo "  Integer arithmetic exceeded type bounds"
    echo ""
    echo "Solutions:"
    echo "  1. Use Solidity 0.8+ (built-in overflow checks)"
    echo "  2. Use SafeMath library for older versions"
    echo "  3. Add explicit bounds checking"
    echo "  4. Use unchecked{} only when safe"
    echo ""

  elif echo "$error_output" | grep -qi "EvmError.*InvalidFEOpcode"; then
    echo -e "${RED}Error Type: Invalid Opcode${NC}"
    echo ""
    echo "Cause:"
    echo "  Attempted to execute invalid opcode"
    echo ""
    echo "Common Causes:"
    echo "  • Calling a contract that self-destructed"
    echo "  • Calling address(0)"
    echo "  • Logic error in assembly code"
    echo "  • Corrupted bytecode"
    echo ""
    echo "Solutions:"
    echo "  1. Check contract exists before calling"
    echo "  2. Validate addresses are not zero"
    echo "  3. Review inline assembly carefully"
    echo ""

  else
    echo -e "${YELLOW}Generic Error${NC}"
    echo ""
    echo "Run with verbose flags for more details:"
    echo "  forge test -vv    (show console.log)"
    echo "  forge test -vvv   (show stack traces)"
    echo "  forge test -vvvv  (show setup traces)"
    echo "  forge test -vvvvv (show all traces including internal)"
    echo ""
  fi

  # Check for specific error patterns
  for pattern in "${!ERROR_PATTERNS[@]}"; do
    if echo "$error_output" | grep -qi "$pattern"; then
      echo -e "${CYAN}Pattern Matched: ${pattern}${NC}"
      echo -e "${ERROR_PATTERNS[$pattern]}"
      echo ""
    fi
  done
}

#
# Function: Decode contract address from create transaction
#
decode_contract_address() {
  local tx_hash="$1"
  local network="${2:-ethereum}"

  echo -e "${BLUE}═══ Contract Address Decoder ═══${NC}"
  echo ""

  if ! command -v cast &> /dev/null; then
    echo -e "${YELLOW}Install foundry's 'cast' for this feature${NC}"
    return 1
  fi

  local rpc_var=$(echo "${network}_RPC_URL" | tr '[:lower:]' '[:upper:]')
  local rpc_url="${!rpc_var}"

  if [ -z "$rpc_url" ]; then
    echo -e "${YELLOW}RPC URL not configured for $network${NC}"
    return 1
  fi

  local receipt=$(cast receipt "$tx_hash" --rpc-url "$rpc_url" 2>&1)
  local contract_address=$(echo "$receipt" | grep "contractAddress" | awk '{print $2}')

  if [ -n "$contract_address" ] && [ "$contract_address" != "null" ]; then
    echo -e "Contract Address: ${GREEN}$contract_address${NC}"
    echo ""

    # Verify contract deployed
    local code=$(cast code "$contract_address" --rpc-url "$rpc_url")

    if [ "$code" == "0x" ]; then
      echo -e "Status: ${RED}No code at address (deployment failed)${NC}"
    else
      local code_size=$((${#code} / 2 - 1)) # Each byte is 2 hex chars
      echo -e "Status: ${GREEN}Contract deployed successfully${NC}"
      echo -e "Code Size: ${CYAN}${code_size} bytes${NC}"
    fi
  else
    echo -e "${RED}No contract address found${NC}"
    echo "This transaction may not be a contract creation"
  fi

  echo ""
}

#
# Function: Interactive debugging mode
#
interactive_debug() {
  echo -e "${MAGENTA}╔════════════════════════════════════════════════════════╗${NC}"
  echo -e "${MAGENTA}║        Advanced Debugging Assistant                   ║${NC}"
  echo -e "${MAGENTA}╚════════════════════════════════════════════════════════╝${NC}"
  echo ""

  while true; do
    echo -e "${CYAN}What would you like to debug?${NC}"
    echo "  1. Analyze failed transaction"
    echo "  2. Decode error data"
    echo "  3. Analyze forge test error"
    echo "  4. Get contract address from deployment tx"
    echo "  5. Exit"
    echo ""
    read -p "Choice: " choice

    case $choice in
      1)
        read -p "Transaction hash: " tx_hash
        read -p "Network (ethereum/bsc/avalanche): " network
        analyze_transaction "$tx_hash" "$network"
        ;;
      2)
        read -p "Error data (0x...): " error_data
        decode_error_data "$error_data"
        ;;
      3)
        echo "Paste forge test error output (end with Ctrl+D):"
        local error_output=$(cat)
        analyze_forge_error "$error_output"
        ;;
      4)
        read -p "Deployment transaction hash: " tx_hash
        read -p "Network: " network
        decode_contract_address "$tx_hash" "$network"
        ;;
      5)
        echo "Exiting..."
        exit 0
        ;;
      *)
        echo -e "${RED}Invalid choice${NC}"
        ;;
    esac

    echo ""
    read -p "Press Enter to continue..."
    echo ""
  done
}

#
# Main CLI
#
main() {
  local command="$1"

  case "$command" in
    tx)
      analyze_transaction "$2" "$3"
      ;;
    decode)
      decode_error_data "$2"
      ;;
    forge)
      analyze_forge_error "$2"
      ;;
    address)
      decode_contract_address "$2" "$3"
      ;;
    interactive|"")
      interactive_debug
      ;;
    help|--help|-h)
      echo "
Advanced Debugging Assistant

Usage:
  ./debug-assistant.sh <command> [options]

Commands:
  tx <hash> [network]      - Analyze failed transaction
  decode <error_data>      - Decode error data (0x...)
  forge <error_output>     - Analyze forge test error
  address <hash> [network] - Get contract address from deployment
  interactive              - Interactive debugging mode (default)
  help                     - Show this help

Examples:
  ./debug-assistant.sh tx 0xabc123... ethereum
  ./debug-assistant.sh decode 0x08c379a0000000...
  ./debug-assistant.sh address 0xdef456... bsc
  ./debug-assistant.sh interactive

Features:
  - Solidity error code decoding
  - Revert reason extraction
  - Stack trace analysis
  - Common error pattern matching
  - Fix recommendations
  - Transaction analysis via RPC
      "
      ;;
    *)
      echo "Unknown command: $command"
      echo "Run './debug-assistant.sh help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
