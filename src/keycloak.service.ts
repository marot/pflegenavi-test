import {Injectable, Logger,} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {ConfigService} from '@nestjs/config';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import type UserRepresentation from '@keycloak/keycloak-admin-client/lib/defs/userRepresentation';
import {differenceInMinutes, isValid} from 'date-fns';

@Injectable()
export class KeycloakService {
    private readonly logger = new Logger(KeycloakService.name);
    private _client: KcAdminClient

    constructor(
        private config: ConfigService
    ) {
        this._client = new KcAdminClient({
            baseUrl: config.get('KEYCLOAK_SERVER'),
            realmName: 'master',
        })
    }

    private async authenticate(): Promise<void> {
        this.logger.log('Authenticating to keycloak');
        await this._client.auth({
            username: 'admin',
            password: 'admin',
            grantType: 'password',
            clientId: 'admin-cli',
        });
    }

    private async reauthOnTokenExpiration(): Promise<void> {
        const newToken = this._client.accessToken;
        if (!newToken) {
            return;
        }

        try {
            const base64Middle = newToken?.split('.')[1];
            const middle = atob(base64Middle);
            const SECOND_TO_MILLISECOND = 1000;
            const expiration = JSON.parse(middle)['exp'];
            const exp = new Date(expiration * SECOND_TO_MILLISECOND);

            this.logger.log(
                `Token expiration: isValid(${isValid(
                    exp
                )}), exp(${exp}), now(${new Date()}), differenceInMinutes(${differenceInMinutes(
                    exp,
                    new Date()
                )})`
            );
            if (!isValid(exp) || differenceInMinutes(exp, new Date()) <= 1) {
                await this.authenticate();
            }
        } catch (err) {
            this.logger.log('Failed to compute token expiration');
            await this.authenticate();
            if (err instanceof Error) {
                this.logger.error(`Failed to re-authenticate: ${err.message}`);
            }
        }
    }

    async getById(id: string): Promise<UserRepresentation | undefined> {
        return await this.withClient(async (client, realm) => {
            this.logger.verbose('Looking for user by id');
            const existingUser = await client.users.findOne({
                realm,
                id,
            });

            return existingUser ?? undefined;
        });
    }

    async deleteUsersByType(type: 'family_member' | 'employee'): Promise<void> {
        await this.withClient(async (client, realm) => {
            const allUsers = await client.users.find({ realm });
            const familyMembers = allUsers.filter(
                (user) => user?.attributes?.type?.[0] === type
            );
            for (const familyMember of familyMembers) {
                if (familyMember.id) {
                    await client.users.del({
                        realm,
                        id: familyMember.id,
                    });
                }
            }
        });
    }

    async withClient<T>(
        cb: (client: KcAdminClient, realm: string) => Promise<T>
    ): Promise<T> {
        const realm = 'master';
        const getClient = async (): Promise<KcAdminClient> => {
            const token = this._client.accessToken;
            if (!token) {
                await this.authenticate();
            }
            await this.reauthOnTokenExpiration();
            return this._client;
        };

        const client = await getClient();
        try {
            return await cb(client, realm);
        } catch (err: any) {
            this.logger.error(err?.message);
            if (err.status === 401) {
                await this.authenticate();
                return await cb(client, realm);
            }
        }
        return {} as T;
    }
}
0