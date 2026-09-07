FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node backend/server.mjs backend/server.mjs
COPY --chown=node:node src/lib/integrity.ts src/lib/integrity.ts
RUN mkdir -p /data && chown node:node /data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8789 PROJECTS_DATA_DIR=/data
EXPOSE 8789
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8789/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "backend/server.mjs"]
