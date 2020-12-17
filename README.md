# arch-makepkg-action

This create a package using the PKGBUILD on the root of the repository

## Usage

```yaml
steps:
- name: Build archlinux package
  uses: atomlong/arch-makepkg-action@master
```

Then you can upload the artifact with your package name and version specified
on the PKGBUILD

## License
The scripts and documentation in this project are released under the [MIT License](LICENSE)
