import { config } from 'dotenv';

// Load environment variables from .env file
config();

/**
 * Configuration interface for TM1 connection in tests
 */
export interface TM1TestConfig {
    address: string;
    port: number;
    user: string;
    password: string;
    ssl: boolean;
    namespace?: string;
    gateway?: string;
}

/**
 * Default test configuration - all values should come from environment variables
 * These are fallback values only and should not contain real credentials
 */
const defaultTestConfig: TM1TestConfig = {
    address: "localhost",
    port: 8879,
    user: "admin",
    password: "", // No default password - must be set via environment
    ssl: false
};

/**
 * Load configuration from environment variables
 * Throws error if required environment variables are not set
 */
export function loadTestConfig(): TM1TestConfig {
    // Check for required environment variables
    if (!process.env.TM1_PASSWORD) {
        throw new Error(
            'TM1_PASSWORD environment variable is required. ' +
            'Please set it in your .env file or environment.'
        );
    }

    return {
        address: process.env.TM1_ADDRESS || defaultTestConfig.address,
        port: parseInt(process.env.TM1_PORT || defaultTestConfig.port.toString()),
        user: process.env.TM1_USER || defaultTestConfig.user,
        password: process.env.TM1_PASSWORD, // Required from environment
        ssl: process.env.TM1_SSL === 'true' || defaultTestConfig.ssl,
        namespace: process.env.TM1_NAMESPACE,
        gateway: process.env.TM1_GATEWAY
    };
}