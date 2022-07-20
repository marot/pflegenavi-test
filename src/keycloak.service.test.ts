import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeycloakService } from './keycloak.service';
import { addMinutes } from 'date-fns';

// TODO: Create proper mocks
const configMock = {
    get: () => '',
};

const tenantService = {
    getTenantId: () => 'default_tenant',
};

const cacheManager = {
    get: () => undefined,
    set: () => {
        return;
    },
};

class KeycloakAdminClient {
    accessToken?: string;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() {}

    auth = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        // Return an access token that will exprine in a couple of minutes
        const middlePart = btoa(
            JSON.stringify({
                exp: addMinutes(new Date(), 5).valueOf() / 1000,
            })
        );
        this.accessToken = `.${middlePart}.`;
    });

    users = {
        findOne: vi.fn(({ id }) => id),
    };
}

describe('Keycloak service', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('will not authenticate multiple times at the same time', async () => {

    });

    it('will not re-authenticate when called right after another', async () => {

    });

    it('will re-authenticate one minute before timer expires', async () => {

    });
});
