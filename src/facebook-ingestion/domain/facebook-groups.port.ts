import type { IncomingFacebookPost } from './incoming-facebook-post';

export const FACEBOOK_GROUPS_PORT = Symbol('FACEBOOK_GROUPS_PORT');

export interface FacebookGroupsPort {
  isConfigured(): boolean;
  fetchRecentPosts(
    groupIds: string[],
    since: Date,
  ): Promise<IncomingFacebookPost[]>;
}
