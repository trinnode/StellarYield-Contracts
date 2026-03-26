//! Tests for burn/burn_from yield accounting fix (Option A).

use crate::tests::make_vault;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_burn_auto_claims_pending_yield() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault_id, token_id, zkme_id, admin) = make_vault(&env);
    let user = Address::generate(&env);
    let operator = Address::generate(&env);
    let vault = crate::SingleRWAVaultClient::new(&env, &vault_id);
    let token = crate::tests::MockTokenClient::new(&env, &token_id);
    let zkme = crate::tests::MockZkmeClient::new(&env, &zkme_id);
    zkme.approve_user(&user);
    vault.set_operator(&admin, &operator, &true);
    vault.activate_vault(&admin);

    // Deposit and create yield
    token.mint(&user, &10_000i128);
    vault.deposit(&user, &10_000i128, &user);
    token.mint(&operator, &2_000i128);
    vault.distribute_yield(&operator, &2_000i128);

    let shares_before = vault.balance(&user);
    let pending_before = vault.pending_yield(&user);
    assert!(shares_before > 0);
    assert!(pending_before > 0);

    // Burn half the shares; should auto-claim pending yield
    let burn_amount = shares_before / 2;
    vault.burn(&user, &burn_amount);

    // Verify: pending yield should be fully claimed after burn
    assert_eq!(vault.pending_yield(&user), 0);
    // Verify: user received some assets back due to yield claim
    let user_asset_balance_after = token.balance(&user);
    assert!(user_asset_balance_after > 0);
    // Verify remaining shares
    assert_eq!(vault.balance(&user), shares_before - burn_amount);
}

#[test]
fn test_burn_from_auto_claims_pending_yield() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault_id, token_id, zkme_id, admin) = make_vault(&env);
    let user = Address::generate(&env);
    let spender = Address::generate(&env);
    let operator = Address::generate(&env);
    let vault = crate::SingleRWAVaultClient::new(&env, &vault_id);
    let token = crate::tests::MockTokenClient::new(&env, &token_id);
    let zkme = crate::tests::MockZkmeClient::new(&env, &zkme_id);
    zkme.approve_user(&user);
    vault.set_operator(&admin, &operator, &true);
    vault.activate_vault(&admin);

    // Deposit and create yield
    token.mint(&user, &10_000i128);
    vault.deposit(&user, &10_000i128, &user);
    token.mint(&operator, &2_000i128);
    vault.distribute_yield(&operator, &2_000i128);

    // User authorizes spender
    let shares_before = vault.balance(&user);
    vault.approve(&user, &spender, &shares_before, &999_999u32);

    // spender burns half the shares; should auto-claim pending yield
    let burn_amount = shares_before / 2;
    vault.burn_from(&spender, &user, &burn_amount);

    // Verify: pending yield should be fully claimed after burn
    assert_eq!(vault.pending_yield(&user), 0);
    // Verify remaining shares and allowance
    assert_eq!(vault.balance(&user), shares_before - burn_amount);
    assert_eq!(
        vault.allowance(&user, &spender),
        shares_before - burn_amount
    );
}

#[test]
fn test_burn_with_no_pending_yield() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault_id, token_id, zkme_id, _admin) = make_vault(&env);
    let user = Address::generate(&env);
    let vault = crate::SingleRWAVaultClient::new(&env, &vault_id);
    let token = crate::tests::MockTokenClient::new(&env, &token_id);
    let zkme = crate::tests::MockZkmeClient::new(&env, &zkme_id);
    zkme.approve_user(&user);

    // Deposit without yield
    token.mint(&user, &5_000i128);
    vault.deposit(&user, &5_000i128, &user);

    let shares_before = vault.balance(&user);
    let pending_before = vault.pending_yield(&user);
    assert_eq!(pending_before, 0);

    // Burn some shares; should not attempt claim
    let burn_amount = 1_000i128;
    vault.burn(&user, &burn_amount);

    // Verify: no yield claimed, pending remains 0
    assert_eq!(vault.pending_yield(&user), 0);
    // Verify: assets unchanged for user (no yield to claim)
    assert_eq!(vault.balance(&user), shares_before - burn_amount);
}
