import { Injectable } from '@nestjs/common';
import type { FacebookGroupsPort } from '../domain/facebook-groups.port';
import type { IncomingFacebookPost } from '../domain/incoming-facebook-post';

@Injectable()
export class NoopFacebookGroupsAdapter implements FacebookGroupsPort {
  isConfigured(): boolean {
    return false;
  }

  fetchRecentPosts(): Promise<IncomingFacebookPost[]> {
    return Promise.resolve([]);
  }
}
