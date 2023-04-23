For: https://github.ibm.com/symposium/track-and-plan/issues/<INSERT ISSUE NUMBER HERE>

**PR checklist**

- [ ] At least one commit message is feat or fix. (this ensures that a new version is published to production)
- [ ] Commits squashed into PR (see steps below)
- [ ] Story or github issue tied to PR (if chore with no issue, indicate in comments)
- [ ] Story in implemented until SonarQube checked and verified
- [ ] If PR is from master to stage title is "prod to stage" to skip redeploy of stage

** Optional **
- [ ] API docs updated
- [ ] README updates

**What changed**
-

**How to test**
1.

**Commits squashed:**
Note reset is on `master` branch

- git checkout yourBranch
- git reset $(git merge-base origin/master $(git branch --show-current))
- git add -A
- git commit -m "fix: updated with new function"