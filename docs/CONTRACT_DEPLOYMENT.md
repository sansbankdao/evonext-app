# EvoNext Contract Deployment Summary

## Contract Details (Updated)
- **Contract ID**: `AyWK6nDVfb8d1ZmkM5MmZZrThbUyWyso1aMeGuuVSfxf`
- **Previous Contract IDs**:
  - `9nzpvjVSStUrhkEs3eNHw2JYpcNoLh1MjmqW45QiyjSa`
  - `AiZopUC5qFAcg58sX5CsMkLoiPywNG3zmJBXT9crunVk`
- **Network**: Testnet
- **Identity ID**: `5DbLwAxGBzUzo81VewMUwn4b5P4bpv9FNFybi25XB5Bk`
- **Deployed**: January 2025
- **Updated**: January 2025 (removed displayName field)

## Latest Update (January 2025)
- **Removed displayName field** from profile document
- App now uses DPNS usernames instead of local displayName
- All profile documents no longer require displayName

## Contract Modifications
Due to Dash Platform validation requirements, the following changes were made:

### 1. Sorting Order
- Changed all index sorting from `desc` to `asc` (platform only supports ascending)

### 2. Default Values
- Removed all `default` values from properties (not supported by platform)

### 3. Complex Arrays
Due to platform limitations with object arrays, we temporarily simplified:
- **media**: Changed from array of objects to single `mediaUrl` string field
- **mentions**: Changed from array to single `firstMentionId` field
- **hashtags**: Changed from array to single `primaryHashtag` string field

### 4. Required Properties
- Added `maxLength` to all string fields (required by platform)

## Document Types (13 total)
1. **profile** - User profile information
2. **avatar** - Avatar customization data
3. **post** - Social media posts
4. **like** - Post likes
5. **repost** - Post reposts/retweets
6. **follow** - Follow relationships
7. **bookmark** - Bookmarked posts
8. **list** - User-created lists
9. **listMember** - Members of lists
10. **block** - Block relationships
11. **mute** - Mute relationships
12. **directMessage** - Encrypted DMs
13. **notification** - User notifications

## Next Steps
1. Update the Dash SDK integration in the app to work with the contract
2. Implement proper identity management and signing
3. Create document creation/query functions
4. Handle the simplified fields (will need app-level logic for multiple media/mentions/hashtags)

## Tools Created
- **Rust CLI Tool**: `/Users/quantum/src/dash-contract-cli/`
  - Registers contracts on Dash Platform using external private keys
  - Uses SimpleSigner for key management
  - Implements trusted context provider for proof verification

## Known Issues
- Identity revision fetch returns 0 but actual nonce is 7+ (hardcoded to 8 for now)
- Need to investigate proper identity state fetching in Rust SDK
