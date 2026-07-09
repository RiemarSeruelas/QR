# Certificate files

Put the server certificate and private key here:

```txt
certs/qr-system.crt
certs/qr-system.key
```

The certificate must include these SANs if you want to open the app by IP on both networks:

```txt
IP Address: 172.27.1.92
IP Address: 10.156.119.146
DNS Name: localhost          optional for local testing
```

## Two ways to get the cert

### Best way
Use a certificate signed by a CA already trusted by the laptops/phones that will access the app.

### Self-provided local CA way
Run `scripts/create-dual-ip-cert.ps1` to create:

```txt
certs/qr-system-root-ca.crt
certs/qr-system.crt
certs/qr-system.key
```

Then install/trust `qr-system-root-ca.crt` on every device that needs camera access without browser warnings.
Do not share or commit `.key` files.
