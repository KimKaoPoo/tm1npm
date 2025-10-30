import { AuthenticationMode } from '../services/RestService';
import { verifyVersion } from '../utils/Utils';

/**
 * Test utility decorators for Jest testing - equivalent to Python test decorators
 */

export function skipIfNoPandas(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    /**
     * Checks whether pandas equivalent exists and skips the test if not
     * Note: In JavaScript/TypeScript, we don't have pandas, so this always skips
     */
    descriptor.value = function (..._args: any[]) {
        // In JavaScript environment, we don't have pandas equivalent
        console.log(`Test '${propertyName}' requires pandas equivalent - skipping`);
        return;
    };
    return descriptor;
}

export function skipIfVersionLowerThan(version: string) {
    /**
     * Checks whether TM1 version is lower than a certain version and skips the test
     * if this is the case. This function is useful if a test needs a minimum required version.
     */
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        descriptor.value = function (...args: any[]) {
            // @ts-ignore - accessing tm1 from test context
            if (!verifyVersion(version, this.tm1.version)) {
                console.log(`Function '${propertyName}' requires TM1 server version >= '${version}' - skipping`);
                return;
            } else {
                return method.apply(this, args);
            }
        };
        return descriptor;
    };
}

export function skipIfVersionHigherOrEqualThan(version: string) {
    /**
     * Checks whether TM1 version is higher or equal than a certain version and skips the test
     * if this is the case. This function is useful if a test should not run for higher versions.
     */
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        descriptor.value = function (...args: any[]) {
            // @ts-ignore - accessing tm1 from test context
            if (verifyVersion(version, this.tm1.version)) {
                console.log(`Function '${propertyName}' requires TM1 server version < '${version}' - skipping`);
                return;
            } else {
                return method.apply(this, args);
            }
        };
        return descriptor;
    };
}

export function skipIfAuthNotBasic(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    /**
     * Checks whether TM1 authentication is basic (user+password). Skip test if authentication is not basic
     */
    const method = descriptor.value;
    descriptor.value = function (...args: any[]) {
        // @ts-ignore - accessing tm1 from test context
        if (this.tm1.connection.authenticationMode !== AuthenticationMode.BASIC) {
            console.log(`Function '${propertyName}' requires IntegratedSecurityMode1 (Basic) - skipping`);
            return;
        } else {
            return method.apply(this, args);
        }
    };
    return descriptor;
}

export function skipIfPaoc(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    /**
     * Checks whether TM1 is deployed as Planning Analytics on Cloud (PAoC)
     */
    const method = descriptor.value;
    descriptor.value = function (...args: any[]) {
        // @ts-ignore - accessing tm1 from test context
        if (this.tm1.connection.baseUrl.includes("planning-analytics.ibmcloud.com/tm1/api")) {
            console.log(`Function '${propertyName}' requires on prem TM1 instead of PAoC - skipping`);
            return;
        } else {
            return method.apply(this, args);
        }
    };
    return descriptor;
}