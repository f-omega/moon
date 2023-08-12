{
  description = "Real estate mailing list";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-22.11";
    flake-utils.url = "github:numtide/flake-utils";
    dagger.url = "github:f-omega/dagger";
  };
  outputs = { self, nixpkgs, dagger, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = import nixpkgs { inherit system; };
      in rec {
        devShells.default = pkgs.stdenv.mkDerivation {
          name = "moon";
          buildInputs = with pkgs; [ nodejs nodePackages.yarn ];
        };
      });
}
