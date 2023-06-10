# API Docs
## Assets schema

```javascript
{
    SFUID: { type : String, required: true, unique: true },
    ArtistWallet: { type : String, required: true },
    NSYSUID: { type : String, required: true },
    IPFSMetadataCID: { type : String, required: true, unique: true },
    ImageCID: { type : String, required: true, unique: true },
    AWS_UID: { type : String, required: true, unique: true },
    MediaName: { type : String, required: true },
    MediaType: { type : String, required: true },
    AssetSizeInBytes: { type : Number, required: true },
    Format: { type : String, required: true },
    MediaDescription: { type : String },
    ExternalURL: { type : String },
    Theme: { type : String },
    Scarcity: { type : String },
    ProductionYear: { type : Number },
    Tags: { type : Array },
}
```
## SEND DATA
```curl
POST https://nsys.inf4mation.com/api/upload
Content-Type: application/json
x-accessKeyId: {{accessKeyId}}
x-secretAccessKey: {{secretAccessKey}}

{
    "file": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD=",
    "MediaName": "web33.jpg",
    "MediaDescription": "sample desc",
    "ArtistName": "Abderrahim",
    "Scarcity": "0",
    "Format": "Date",
    "Theme": "First",
    "Tags": "welcome",
    "AssetType": "new",
    "AssetSizeInBytes": "2509",
    "ProductionYear": "2021",
    "NSYSUID": "33887772",
    "SFUID": "97b78063-fba7-432b-8c0d-c8ee0be6841v",
    "ArtistWallet": "0x0000000000000000000000000000000000000000",
    "AWS_UID": "WILL_BE_GENERATED_AUTOMATICALLY",
    "ExternalURL": "WILL_BE_REPLACED",
    "ImageCID": "WILL_BE_REPLACED",
    "IPFSMetadataCID": "WILL_BE_REPLACED"
}
```
## GET ONE
You can get item using `SFUID, NSYSUID, ArtistWallet, AWS_UID or IPFSMetadataCID`
>> _EXAMPLE REQUEST_
```curl
GET https://nsys.inf4mation.com/api/assets/get?SFUID=97b78063-fba7-432b-8c0d-c8ee0be6841v
```
>>  _EXAMPLE RESPONSE_
```json
{
    "SFUID": "97b78063-fba7-432b-8c0d-c8ee0be6841h",
    "ArtistWallet": "0x0000000000000000000000000000000000000000",
    "NSYSUID": "33887772",
    "IPFSMetadataCID": "QmPQoDPVSNNiC6D9wJ9TvCyN9X6kboGsCyLyTfWe7X1yo4",
    "ImageCID": "QmX4rtQjdgMSZwprY7wJwEJct6uNccZFUrJP1zdDuTs7NZ"
    ...
}
```

## SEARCH
You can search using any of these parameters `SFUID, NSYSUID, ArtistWallet, AWS_UID, MediaName, MediaType, MediaDescription, AssetSizeInBytes, ExternalURL, Format, Theme, Scarcity, ProductionYear and/or Tags`

>>  EXAMPLE REQUEST
```curl
GET https://nsys.inf4mation.com/api/assets/search?ArtistName=Abderrahim
```
>> Example Response
```json
{
    "results": [
        {
        "SFUID": "97b78063-fba7-432b-8c0d-c8ee0be6841h",
        "ArtistWallet": "0x0000000000000000000000000000000000000000",
        "NSYSUID": "33887772"
        ...
        }
        ...
    ],
    "paginate": {
        "page": 1,
        "limit": 20,
        "total": 2
    }
}
```
