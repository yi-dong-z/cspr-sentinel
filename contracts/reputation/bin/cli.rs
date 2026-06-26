use cspr_sentinel_reputation::{ReputationRegistry, ReputationRegistryInitArgs};
use odra::host::HostEnv;
use odra_cli::deploy::DeployScript;
use odra_cli::{DeployedContractsContainer, DeployerExt, OdraCli};

pub struct DeployReputationRegistry;

impl DeployScript for DeployReputationRegistry {
    fn deploy(
        &self,
        env: &HostEnv,
        container: &mut DeployedContractsContainer,
    ) -> Result<(), odra_cli::deploy::Error> {
        ReputationRegistry::load_or_deploy(
            env,
            ReputationRegistryInitArgs {
                operator: env.get_account(0),
            },
            container,
            350_000_000_000,
        )?;
        Ok(())
    }
}

fn main() {
    OdraCli::new()
        .about("Deploy and inspect the CSPR Sentinel reputation registry")
        .deploy(DeployReputationRegistry)
        .contract::<ReputationRegistry>()
        .build()
        .run();
}
