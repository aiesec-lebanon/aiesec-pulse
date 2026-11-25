// No imports: read by a unit test that must not need a database.

/** How erasure treats each relation of User; checked against the schema by a unit test. */
export const ERASURE_COVERAGE: Record<string, string> = {
  primaryEntity: "kept: an office, not personal data",
  grants: "revoked",
  posts: "kept as 'Former member', or emptied and archived (remove)",
  promotedPosts: "kept: attribution to the anonymised account",
  postVersions: "versions of own posts deleted (remove); edits elsewhere kept, anonymised",
  comments: "kept as 'Former member', or emptied (remove)",
  mentions: "deleted",
  reactions: "deleted, counters corrected",
  bookmarks: "deleted",
  reads: "deleted",
  acknowledgements: "deleted",
  follows: "deleted, including other members' follows of this person",
  sessions: "revoked and deleted",
  oauthToken: "deleted",
  notifications: "deleted",
  notificationPrefs: "deleted",
  digestSetting: "deleted",
  pushSubscriptions: "deleted",
  emailDeliveries: "deleted",
  media: "detached; images no remaining post uses are swept",
  reportsFiled: "kept: moderation record, reporter anonymised",
  reportsAssigned: "kept: moderation record, assignee anonymised",
  appeals: "kept: moderation record, appellant anonymised",
  restrictions: "kept: moderation record",
};
