#![cfg_attr(not(test), no_std)]

extern crate alloc;

use alloc::string::String;
use odra::prelude::*;

#[odra::odra_type]
#[derive(Default)]
pub struct ReputationCounters {
    pub payment_attempts: u64,
    pub payment_successes: u64,
    pub policy_attempts: u64,
    pub policy_compliant: u64,
    pub approval_resolved: u64,
    pub approval_approved: u64,
    pub delivery_attempts: u64,
    pub delivery_successes: u64,
    pub rating_count: u64,
    pub rating_sum: u64,
}

#[odra::odra_error]
pub enum ReputationError {
    Unauthorized = 1,
    DuplicatePurchase = 10,
    PurchaseNotFound = 11,
    DuplicateRating = 12,
    InvalidRating = 13,
}

#[odra::event]
pub struct PurchaseAnchored {
    pub purchase_id: String,
    pub deploy_hash: String,
    pub agent_id: String,
    pub provider_id: String,
}

#[odra::event]
pub struct ProviderRated {
    pub purchase_id: String,
    pub provider_id: String,
    pub score: u8,
    pub evidence_hash: String,
}

#[odra::module]
pub struct ReputationRegistry {
    operator: Var<Address>,
    counters: Mapping<String, ReputationCounters>,
    purchase_receipts: Mapping<String, String>,
    rated_purchases: Mapping<String, bool>,
}

#[odra::module]
impl ReputationRegistry {
    pub fn init(&mut self, operator: Address) {
        self.operator.set(operator);
    }

    pub fn record_purchase(
        &mut self,
        purchase_id: String,
        deploy_hash: String,
        agent_id: String,
        provider_id: String,
        agent_payment_attempts: u64,
        agent_payment_successes: u64,
        agent_policy_attempts: u64,
        agent_policy_compliant: u64,
        agent_approval_resolved: u64,
        agent_approval_approved: u64,
        provider_delivery_attempts: u64,
        provider_delivery_successes: u64,
        provider_rating_count: u64,
        provider_rating_sum: u64,
    ) {
        self.assert_operator();
        if self.purchase_receipts.get(&purchase_id).is_some() {
            self.env().revert(ReputationError::DuplicatePurchase);
        }
        self.purchase_receipts.set(&purchase_id, deploy_hash.clone());
        self.counters.set(&agent_id, ReputationCounters {
            payment_attempts: agent_payment_attempts,
            payment_successes: agent_payment_successes,
            policy_attempts: agent_policy_attempts,
            policy_compliant: agent_policy_compliant,
            approval_resolved: agent_approval_resolved,
            approval_approved: agent_approval_approved,
            ..Default::default()
        });
        self.counters.set(&provider_id, ReputationCounters {
            delivery_attempts: provider_delivery_attempts,
            delivery_successes: provider_delivery_successes,
            rating_count: provider_rating_count,
            rating_sum: provider_rating_sum,
            ..Default::default()
        });
        self.env().emit_event(PurchaseAnchored { purchase_id, deploy_hash, agent_id, provider_id });
    }

    pub fn record_provider_rating(
        &mut self,
        purchase_id: String,
        provider_id: String,
        score: u8,
        evidence_hash: String,
        provider_delivery_attempts: u64,
        provider_delivery_successes: u64,
        provider_rating_count: u64,
        provider_rating_sum: u64,
    ) {
        self.assert_operator();
        if self.purchase_receipts.get(&purchase_id).is_none() {
            self.env().revert(ReputationError::PurchaseNotFound);
        }
        if self.rated_purchases.get(&purchase_id).unwrap_or(false) {
            self.env().revert(ReputationError::DuplicateRating);
        }
        if !(1..=5).contains(&score) {
            self.env().revert(ReputationError::InvalidRating);
        }
        self.rated_purchases.set(&purchase_id, true);
        self.counters.set(&provider_id, ReputationCounters {
            delivery_attempts: provider_delivery_attempts,
            delivery_successes: provider_delivery_successes,
            rating_count: provider_rating_count,
            rating_sum: provider_rating_sum,
            ..Default::default()
        });
        self.env().emit_event(ProviderRated { purchase_id, provider_id, score, evidence_hash });
    }

    pub fn get_counters(&self, subject_id: String) -> ReputationCounters {
        self.counters.get(&subject_id).unwrap_or_default()
    }

    pub fn get_purchase_receipt(&self, purchase_id: String) -> Option<String> {
        self.purchase_receipts.get(&purchase_id)
    }

    pub fn is_rated(&self, purchase_id: String) -> bool {
        self.rated_purchases.get(&purchase_id).unwrap_or(false)
    }

    fn assert_operator(&self) {
        if self.operator.get().unwrap() != self.env().caller() {
            self.env().revert(ReputationError::Unauthorized);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{ReputationRegistry, ReputationRegistryHostRef, ReputationRegistryInitArgs};
    use odra::host::Deployer;

    fn deployed() -> (odra::host::HostEnv, ReputationRegistryHostRef) {
        let env = odra_test::env();
        let operator = env.get_account(0);
        let contract = ReputationRegistry::deploy(&env, ReputationRegistryInitArgs { operator });
        (env, contract)
    }

    fn record_purchase(contract: &mut ReputationRegistryHostRef) {
        contract.record_purchase(
            "purchase-1".to_string(),
            "deploy-hash-1".to_string(),
            "agent-1".to_string(),
            "provider-1".to_string(),
            1,
            1,
            1,
            1,
            0,
            0,
            1,
            1,
            0,
            0,
        );
    }

    #[test]
    fn anchors_purchase_and_one_rating() {
        let (_env, mut contract) = deployed();
        record_purchase(&mut contract);

        assert_eq!(contract.get_purchase_receipt("purchase-1".to_string()), Some("deploy-hash-1".to_string()));
        assert_eq!(contract.get_counters("agent-1".to_string()).payment_successes, 1);
        assert_eq!(contract.get_counters("provider-1".to_string()).delivery_successes, 1);

        contract.record_provider_rating(
            "purchase-1".to_string(),
            "provider-1".to_string(),
            5,
            "evidence-hash-1".to_string(),
            1,
            1,
            1,
            5,
        );
        assert!(contract.is_rated("purchase-1".to_string()));
        assert_eq!(contract.get_counters("provider-1".to_string()).rating_sum, 5);
    }

    #[test]
    #[should_panic]
    fn rejects_duplicate_purchase_receipt() {
        let (_env, mut contract) = deployed();
        record_purchase(&mut contract);
        record_purchase(&mut contract);
    }

    #[test]
    #[should_panic]
    fn rejects_non_operator() {
        let (env, mut contract) = deployed();
        env.set_caller(env.get_account(1));
        record_purchase(&mut contract);
    }
}
