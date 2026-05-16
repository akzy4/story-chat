.PHONY: install dev build lint type-check deploy deploy-preview

install:
	npm install

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

type-check:
	npm run type-check

deploy:
	npx vercel --prod

deploy-preview:
	npx vercel
