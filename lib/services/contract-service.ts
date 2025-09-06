/**
 * Service for managing local data contracts
 */

import evonextContractJson from '../../contracts/evonext-contract.json'

export interface DataContract {
    $id?: string
    $format_version: string
    $schema: string
    version: number
    ownerId: string
    documents: Record<string, any>
}

class ContractService {
    private evonextContract: DataContract | null = null
    private contractId: string | null = null

    /**
     * Get the evonext contract with the specified owner ID and contract ID
     */
    getEvoNextContract(ownerId: string, contractId: string): DataContract {
        if (!this.evonextContract || this.contractId !== contractId) {
            // Create a copy and set the owner ID and contract ID
            this.evonextContract = {
                ...evonextContractJson,
                ownerId,
                $id: contractId
            }

            this.contractId = contractId
        }

        return this.evonextContract
    }

    /**
     * Get the evonext contract JSON as a string
     */
    getEvoNextContractJson(ownerId: string, contractId: string): string {
        const contract = this.getEvoNextContract(ownerId, contractId)
        return JSON.stringify(contract)
    }

    /**
     * Validate if a contract ID matches our evonext contract
     */
    isEvoNextContract(contractId: string): boolean {
        return this.contractId === contractId
    }
}

// Singleton instance
export const contractService = new ContractService()
