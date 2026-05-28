import { ListingDraft } from '../../listing/domain/listing-draft';
import { IncomingEmail } from './incoming-email';

export const LISTING_PARSER_REGISTRY = Symbol('LISTING_PARSER_REGISTRY');

export interface ListingParserPort {
  readonly name: string;
  canParse(email: IncomingEmail): boolean;
  parse(email: IncomingEmail): ListingDraft[];
}

export interface ListingParserRegistryPort {
  parse(email: IncomingEmail): ListingDraft[];
}
