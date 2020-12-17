FROM archlinux/base:latest

RUN pacman -Syu --needed --noconfirm \
    binutils \
    fakeroot \
    grep \
    namcap \
    sudo

RUN getent group arch &>/dev/null || groupadd "arch"
RUN getent passwd arch &>/dev/null || useradd -m "arch" -s "/bin/bash" -g "arch"
RUN echo "arch ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers
RUN chown -R arch:arch ${GITHUB_WORKSPACE}

ENV CI_REPO	${GITHUB_REPOSITORY}
ENV CI_BUILD_DIR ${GITHUB_WORKSPACE}
ENV CI_COMMIT ${GITHUB_SHA}
ENV CI_BRANCH ${GITHUB_REF#*refs/heads/}
ENV CI_BUILD_NUMBER ${GITHUB_RUN_NUMBER}

USER arch

COPY scripts/ci-build.sh /ci-build.sh

ENTRYPOINT ["/ci-build.sh"]
