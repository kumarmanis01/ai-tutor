# FILE OBJECTIVE:
# - Provide short local development shortcuts for the Docker hot-reload stack.
#
# LINKED UNIT TEST:
# - tests/unit/docs/docker_compose.spec.ts
#
# COPILOT INSTRUCTIONS FOLLOWED:
# - /docs/ENGINEERING_PRACTICES.md
# - .github/copilot-instructions.md
#
# EDIT LOG:
# - 2026-04-26T00:00:00Z | copilot | update Make targets to match the rebuilt Docker development workflow

.PHONY: up down down-volumes restart logs logs-svc ps shell-web shell-worker migrate migrate-force seed prisma-studio

up:
	docker compose up --build

down:
	docker compose down --remove-orphans

down-volumes:
	docker compose down -v --remove-orphans

restart:
	docker compose restart $(svc)

logs:
	docker compose logs -f --tail=200

logs-svc:
	docker compose logs -f --tail=200 $(svc)

ps:
	docker compose ps

shell-web:
	docker compose exec web sh

shell-worker:
	docker compose exec worker sh

migrate:
	docker compose run --rm web npx prisma migrate dev --schema=prisma/schema.prisma
	docker compose run --rm web node scripts/prisma-generate-with-retry.cjs

migrate-force:
	docker compose run --rm web npx prisma migrate reset --force --schema=prisma/schema.prisma
	docker compose run --rm web node scripts/prisma-generate-with-retry.cjs

seed:
	docker compose run --rm web npm run seed

prisma-studio:
	docker compose run --rm -p 5555:5555 web npx prisma studio --browser none
