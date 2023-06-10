# IPFS with S3 and DynamoDB
- Project location
    - /var/local/
- App Port
    - 4466
- Public api url
    - https://nsys.inf4mation.com
- Upload endpoint
    - /api/upload
- nginx config path
    - /etc/nginx/conf.d/nsys.inf4mation.com.conf
# To Run this Project directly
- npm i
- node index.js
# To Run this Project with pm2
- npm i pm2 -g
- npm i
- pm2 start index.js --name ipfs-service

# reload app
- pm2 reload ipfs-service